import test from "node:test";
import assert from "node:assert/strict";

import { buildStudioForwardingHint, buildStudioSshTunnelHint, isStudioSshSession } from "../shared/studio-ssh-hint.js";

test("isStudioSshSession detects standard SSH environment variables", () => {
  assert.equal(isStudioSshSession({}), false);
  assert.equal(isStudioSshSession({ SSH_CONNECTION: "" }), false);
  assert.equal(isStudioSshSession({ SSH_CONNECTION: "client 123 server 22" }), true);
  assert.equal(isStudioSshSession({ SSH_CLIENT: "client 123 22" }), true);
  assert.equal(isStudioSshSession({ SSH_TTY: "/dev/ttys001" }), true);
});

test("buildStudioSshTunnelHint includes the full tokenized Studio URL in the SSH hint", () => {
  const url = "http://127.0.0.1:55914/?token=abc123&docSource=blank";
  const hint = buildStudioSshTunnelHint(55914, url, { SSH_CONNECTION: "client 123 server 22" });

  assert.ok(hint);
  assert.match(hint, /SSH detected/);
  assert.match(hint, /ssh -L 55914:127\.0\.0\.1:55914 <remote-host>/);
  assert.match(hint, /Then open this Studio URL in your local browser:/);
  assert.match(hint, /http:\/\/127\.0\.0\.1:55914\/\?token=abc123&docSource=blank/);
  assert.doesNotMatch(hint, /URL above/i);
});

test("buildStudioSshTunnelHint returns null outside SSH", () => {
  assert.equal(buildStudioSshTunnelHint(55914, "http://127.0.0.1:55914/?token=abc123", {}), null);
});

test("buildStudioForwardingHint works without SSH auto-detection", () => {
  const url = "http://127.0.0.1:3417/?token=abc123";
  const hint = buildStudioForwardingHint(3417, url, { prefix: "Browser auto-open was skipped." });

  assert.match(hint, /Browser auto-open was skipped/);
  assert.match(hint, /ssh -L 3417:127\.0\.0\.1:3417 <remote-host>/);
  assert.match(hint, /http:\/\/127\.0\.0\.1:3417\/\?token=abc123/);
});
