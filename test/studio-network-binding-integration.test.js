import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, get as httpGet } from "node:http";
import { connect as connectTcp } from "node:net";
import { networkInterfaces, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const repositoryRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const piCliPath = fileURLToPath(new URL(
  "../node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js",
  import.meta.url,
));
const extensionPath = fileURLToPath(new URL("../index.ts", import.meta.url));

function reserveFreePort() {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = createServer();
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.ok(address && typeof address === "object");
      const { port } = address;
      server.close((error) => error ? rejectPromise(error) : resolvePromise(port));
    });
  });
}

function findNonLoopbackIpv4Address() {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if ((entry.family === "IPv4" || entry.family === 4) && !entry.internal) return entry.address;
    }
  }
  return null;
}

function requestStatus(url) {
  return new Promise((resolvePromise, rejectPromise) => {
    const request = httpGet(url, (response) => {
      response.resume();
      response.once("end", () => resolvePromise(response.statusCode ?? 0));
    });
    request.setTimeout(5_000, () => request.destroy(new Error("HTTP request timed out")));
    request.once("error", rejectPromise);
  });
}

function expectTcpConnection(host, port, expected) {
  return new Promise((resolvePromise, rejectPromise) => {
    const socket = connectTcp({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      rejectPromise(new Error(`TCP connection to ${host}:${port} timed out`));
    }, 3_000);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      if (expected) resolvePromise();
      else rejectPromise(new Error(`Unexpected TCP connection to ${host}:${port}`));
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      if (expected) rejectPromise(error);
      else resolvePromise();
    });
  });
}

function rawHttpStatus({ host, port, target, hostHeader, origin, websocket = false }) {
  return new Promise((resolvePromise, rejectPromise) => {
    const socket = connectTcp({ host, port });
    const timer = setTimeout(() => socket.destroy(new Error("Raw HTTP request timed out")), 5_000);
    let response = "";
    socket.once("connect", () => {
      const headers = [
        `GET ${target} HTTP/1.1`,
        `Host: ${hostHeader}`,
        websocket ? "Connection: Upgrade" : "Connection: close",
      ];
      if (websocket) {
        headers.push(
          "Upgrade: websocket",
          "Sec-WebSocket-Version: 13",
          `Sec-WebSocket-Key: ${randomBytes(16).toString("base64")}`,
        );
      }
      if (origin) headers.push(`Origin: ${origin}`);
      socket.write(`${headers.join("\r\n")}\r\n\r\n`);
    });
    socket.on("data", (chunk) => {
      response += chunk.toString("latin1");
      const firstLineEnd = response.indexOf("\r\n");
      if (firstLineEnd < 0) return;
      const match = /^HTTP\/1\.1 (\d+)/.exec(response.slice(0, firstLineEnd));
      clearTimeout(timer);
      socket.destroy();
      if (!match) rejectPromise(new Error(`Invalid HTTP response: ${response.slice(0, 200)}`));
      else resolvePromise(Number(match[1]));
    });
    socket.once("error", rejectPromise);
  });
}

function notificationMessages(events) {
  return events
    .filter((event) => event?.type === "extension_ui_request" && event.method === "notify")
    .map((event) => ({ type: event.notifyType, message: String(event.message ?? "") }));
}

function extractLastStudioUrl(events) {
  const urls = notificationMessages(events)
    .flatMap(({ message }) => message.match(/http:\/\/127\.0\.0\.1:\d+\/\?[^\s]+/g) ?? []);
  assert.ok(urls.length > 0, "expected a tokenized loopback Studio URL");
  return new URL(urls.at(-1));
}

function createRpcPi(homeDirectory) {
  const child = spawn(process.execPath, [
    piCliPath,
    "--no-session",
    "--no-extensions",
    "-e",
    extensionPath,
    "--mode",
    "rpc",
  ], {
    cwd: repositoryRoot,
    env: { ...process.env, HOME: homeDirectory, USERPROFILE: homeDirectory },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdoutBuffer = Buffer.alloc(0);
  let stderr = "";
  const events = [];
  const waiters = new Map();
  let nextRequestId = 0;
  let terminalError = null;

  const settleExit = (error) => {
    terminalError ??= error;
    for (const waiter of waiters.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    waiters.clear();
  };

  child.stdout.on("data", (chunk) => {
    stdoutBuffer = Buffer.concat([stdoutBuffer, chunk]);
    for (;;) {
      const newlineIndex = stdoutBuffer.indexOf(0x0a);
      if (newlineIndex < 0) break;
      const line = stdoutBuffer.subarray(0, newlineIndex).toString("utf8");
      stdoutBuffer = stdoutBuffer.subarray(newlineIndex + 1);
      if (!line) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch (error) {
        settleExit(new Error(`Invalid Pi RPC JSON: ${line}\n${error}`));
        continue;
      }
      events.push(event);
      const waiter = typeof event.id === "string" ? waiters.get(event.id) : null;
      if (waiter && event.type === "response") {
        waiters.delete(event.id);
        clearTimeout(waiter.timer);
        if (event.success) waiter.resolve(events.slice(waiter.startIndex));
        else waiter.reject(new Error(`Pi RPC command failed: ${JSON.stringify(event)}`));
      }
    }
  });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
  child.stdin.on("error", (error) => settleExit(error));
  child.once("error", (error) => settleExit(error));
  child.once("exit", (code, signal) => {
    settleExit(new Error(`Pi RPC exited unexpectedly (${code ?? signal}).\n${stderr}`));
  });

  return {
    child,
    stderr: () => stderr,
    command(message, timeoutMs = 20_000) {
      if (terminalError || child.exitCode !== null || child.signalCode !== null) {
        return Promise.reject(terminalError ?? new Error("Pi RPC is not running"));
      }
      const id = `network-smoke-${++nextRequestId}`;
      const startIndex = events.length;
      return new Promise((resolvePromise, rejectPromise) => {
        const timer = setTimeout(() => {
          waiters.delete(id);
          rejectPromise(new Error(`Pi RPC command timed out: ${message}\n${stderr}`));
        }, timeoutMs);
        waiters.set(id, { startIndex, timer, resolve: resolvePromise, reject: rejectPromise });
        child.stdin.write(`${JSON.stringify({ id, type: "prompt", message })}\n`, (error) => {
          if (!error) return;
          const waiter = waiters.get(id);
          if (!waiter) return;
          waiters.delete(id);
          clearTimeout(waiter.timer);
          waiter.reject(error);
        });
      });
    },
    async close() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill("SIGTERM");
      await new Promise((resolvePromise) => {
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          resolvePromise();
        }, 5_000);
        child.once("exit", () => {
          clearTimeout(timer);
          resolvePromise();
        });
      });
    },
  };
}

test("/studio --listen-all runs the production server lifecycle safely", { timeout: 45_000 }, async (t) => {
  const isolatedHome = mkdtempSync(join(tmpdir(), "pi-studio-network-test-"));
  const rpc = createRpcPi(isolatedHome);
  t.after(async () => {
    try {
      await rpc.command("/studio --stop", 5_000);
    } catch {
      // Best-effort cleanup after a failed assertion.
    }
    await rpc.close();
    rmSync(isolatedHome, { recursive: true, force: true });
  });

  const networkHost = findNonLoopbackIpv4Address();
  const localPort = await reserveFreePort();
  const localEvents = await rpc.command(`/studio --no-browser --port ${localPort}`);
  const localUrl = extractLastStudioUrl(localEvents);
  assert.equal(localUrl.hostname, "127.0.0.1");
  assert.equal(localUrl.port, String(localPort));
  assert.equal(await requestStatus(localUrl), 200);
  if (networkHost) await expectTcpConnection(networkHost, localPort, false);

  const mismatchEvents = await rpc.command(`/studio --no-browser --listen-all --port ${localPort}`);
  const mismatchMessages = notificationMessages(mismatchEvents);
  assert.ok(mismatchMessages.some(({ message }) => message.includes("already bound to localhost") && message.includes("--listen-all")));
  assert.ok(!mismatchMessages.some(({ message }) => message.includes("Security warning")));
  const localStatus = notificationMessages(await rpc.command("/studio --status"));
  assert.ok(localStatus.some(({ message }) => message.includes(`listening on 127.0.0.1:${localPort}`)));
  await rpc.command("/studio --stop");

  const wildcardPort = await reserveFreePort();
  const wildcardEvents = await rpc.command(`/studio --no-browser --listen-all --port ${wildcardPort}`);
  const wildcardUrl = extractLastStudioUrl(wildcardEvents);
  assert.equal(wildcardUrl.hostname, "127.0.0.1");
  assert.equal(wildcardUrl.port, String(wildcardPort));
  const wildcardMessages = notificationMessages(wildcardEvents);
  assert.ok(wildcardMessages.some(({ type, message }) => (
    type === "warning"
    && message.includes(`0.0.0.0:${wildcardPort}`)
    && message.includes(wildcardUrl.href)
  )));
  assert.ok(!wildcardMessages.some(({ message }) => message.includes("ssh -L")));
  assert.equal(await requestStatus(wildcardUrl), 200);
  assert.equal(await requestStatus(`http://127.0.0.1:${wildcardPort}/`), 403);
  assert.equal(await requestStatus(`http://127.0.0.1:${wildcardPort}/health`), 200);
  if (networkHost) {
    await expectTcpConnection(networkHost, wildcardPort, true);
    const networkUrl = new URL(wildcardUrl);
    networkUrl.hostname = networkHost;
    assert.equal(await requestStatus(networkUrl), 200);
  }

  const token = wildcardUrl.searchParams.get("token");
  assert.ok(token);
  const websocketTarget = `/ws?token=${encodeURIComponent(token)}`;
  const loopbackAuthority = `127.0.0.1:${wildcardPort}`;
  assert.equal(await rawHttpStatus({
    host: "127.0.0.1",
    port: wildcardPort,
    target: websocketTarget,
    hostHeader: loopbackAuthority,
    origin: `http://${loopbackAuthority}`,
    websocket: true,
  }), 101);
  assert.equal(await rawHttpStatus({
    host: "127.0.0.1",
    port: wildcardPort,
    target: websocketTarget,
    hostHeader: loopbackAuthority,
    origin: "https://attacker.invalid",
    websocket: true,
  }), 403);
  assert.equal(await rawHttpStatus({
    host: "127.0.0.1",
    port: wildcardPort,
    target: "/ws?token=wrong",
    hostHeader: loopbackAuthority,
    origin: `http://${loopbackAuthority}`,
    websocket: true,
  }), 401);
  assert.equal(await rawHttpStatus({
    host: "127.0.0.1",
    port: wildcardPort,
    target: `http://attacker.invalid/?token=${encodeURIComponent(token)}`,
    hostHeader: loopbackAuthority,
  }), 400);

  const wildcardStatus = notificationMessages(await rpc.command("/studio --status"));
  assert.ok(wildcardStatus.some(({ message }) => message.includes(`listening on 0.0.0.0:${wildcardPort}`)));
  assert.ok(wildcardStatus.some(({ type, message }) => type === "warning" && message.includes(wildcardUrl.origin)));
  await rpc.command("/studio --stop");

  const restoredPort = await reserveFreePort();
  const restoredEvents = await rpc.command(`/studio --no-browser --port ${restoredPort}`);
  const restoredUrl = extractLastStudioUrl(restoredEvents);
  assert.equal(await requestStatus(restoredUrl), 200);
  const restoredStatus = notificationMessages(await rpc.command("/studio --status"));
  assert.ok(restoredStatus.some(({ message }) => message.includes(`listening on 127.0.0.1:${restoredPort}`)));
  assert.ok(!restoredStatus.some(({ message }) => message.includes("Security warning")));
  await rpc.command("/studio --stop");

  assert.equal(rpc.stderr(), "");
});
