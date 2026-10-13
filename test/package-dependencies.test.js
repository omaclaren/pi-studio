import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lockfile = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const importedHostPackages = [
  "@earendil-works/pi-ai",
  "@earendil-works/pi-coding-agent",
  "@sinclair/typebox",
];
const hostPackages = new Set([
  ...importedHostPackages,
  "@earendil-works/pi-agent-core",
  "@earendil-works/pi-tui",
  "typebox",
]);

test("Pi supplies host imports at runtime; local copies are development-only", () => {
  for (const name of importedHostPackages) {
    assert.equal(manifest.peerDependencies?.[name], "*", `${name} must be a wildcard peer`);
    assert.ok(manifest.devDependencies?.[name], `${name} must be available for typechecking`);
  }
  for (const name of hostPackages) {
    assert.equal(manifest.dependencies?.[name], undefined, `${name} must not be a runtime dependency`);
    assert.equal(manifest.optionalDependencies?.[name], undefined, `${name} must not be an optional runtime dependency`);
  }
});

test("the lockfile keeps host-provided packages out of production dependencies", () => {
  for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
    assert.deepEqual(lockfile.packages[""][field], manifest[field], `${field} must match the manifest`);
  }
  for (const name of importedHostPackages) {
    assert.equal(lockfile.packages[`node_modules/${name}`]?.dev, true, `${name} must be development-only`);
  }
});
