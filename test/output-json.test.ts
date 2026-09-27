import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import type { SpawnSyncReturns } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { CollectionResult } from "../skills/ai-hp/scripts/collect.ts";
import { buildJsonOutput } from "../skills/ai-hp/scripts/output-json.ts";
import type { Snapshot } from "../skills/ai-hp/scripts/types.ts";

const now = new Date("2026-09-26T12:00:00Z");
function snapshot(key: string): Snapshot {
  return {
    provider: "codex", accountKey: key, email: "test@example.com", sources: ["/fixture/.codex"],
    fetchedAt: new Date("2026-09-25T12:00:00Z"),
    limits: [{ kind: "weekly", usedPercent: 100, resetsAt: new Date("2026-09-26T11:00:00Z") }],
  };
}
function result(overrides: Partial<CollectionResult> = {}): CollectionResult {
  return { fresh: [], cached: [], issues: [], excluded: [], now, ...overrides };
}

describe("JSON v1 contract", () => {
  it("preserves observed values even after reset/credit expiry, with explicit cache freshness", () => {
    const cached = { ...snapshot("old"), resetCredits: { available: 1, items: [{ title: "Full reset", count: 1, expiresAt: new Date("2026-09-26T11:00:00Z") }] } };
    const output = buildJsonOutput(result({ cached: [cached] }));
    assert.equal(output.schemaVersion, 1);
    assert.equal(output.generatedAt, "2026-09-26T12:00:00.000Z");
    assert.equal(output.status, "partial");
    assert.equal(output.accounts[0].freshness, "cached");
    assert.equal(output.accounts[0].limits[0].usedPercent, 100);
    assert.equal(output.accounts[0].resetCredits.available, 1);
    assert.equal(output.accounts[0].fetchedAt, "2026-09-25T12:00:00.000Z");
    assert.deepEqual(JSON.parse(JSON.stringify(output)), output);
  });

  it("distinguishes zero credits, unknown credits and unsupported credits", () => {
    const output = buildJsonOutput(result({ fresh: [
      { ...snapshot("zero"), resetCredits: { available: 0, items: [] } },
      snapshot("unknown"),
      { ...snapshot("unsupported"), resetCreditsOff: true },
    ] }));
    const credits = Object.fromEntries(output.accounts.map((a) => [a.accountKey, a.resetCredits]));
    assert.deepEqual([credits.zero.status, credits.zero.available], ["available", 0]);
    assert.deepEqual([credits.unknown.status, credits.unknown.available], ["unknown", null]);
    assert.deepEqual([credits.unsupported.status, credits.unsupported.available], ["unsupported", null]);
  });

  it("sorts upcoming weekly resets first and preserves model-specific and short-term windows", () => {
    const fresh: Snapshot = { ...snapshot("next"), limits: [
      { kind: "weekly", usedPercent: 21.5, resetsAt: new Date("2026-09-27T00:00:00Z") },
      { kind: "scoped", scope: "Fable", usedPercent: 0 },
      { kind: "short", windowHours: 5, usedPercent: 90 },
    ] };
    const output = buildJsonOutput(result({ fresh: [snapshot("past"), fresh] }));
    assert.equal(output.accounts[0].accountKey, "next");
    assert.deepEqual(output.accounts[0].limits, [
      { kind: "weekly", scope: null, windowHours: null, usedPercent: 21.5, resetsAt: "2026-09-27T00:00:00.000Z" },
      { kind: "scoped", scope: "Fable", windowHours: null, usedPercent: 0, resetsAt: null },
      { kind: "short", scope: null, windowHours: 5, usedPercent: 90, resetsAt: null },
    ]);
  });

  it("separates empty, successful, partial and failed results", () => {
    const issue = { code: "collection_failed" as const, provider: "codex" as const, sources: ["/fixture/.codex"], message: "offline" };
    assert.equal(buildJsonOutput(result()).status, "empty");
    assert.equal(buildJsonOutput(result({ fresh: [snapshot("a")] })).status, "ok");
    assert.equal(buildJsonOutput(result({ fresh: [snapshot("a")], issues: [issue] })).status, "partial");
    const failed = buildJsonOutput(result({ cached: [snapshot("a")], issues: [issue] }));
    assert.equal(failed.status, "error");
    assert.equal(failed.exitCode, 1);
    assert.equal(failed.accounts.length, 1);
  });
});

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// A real CLI subprocess, but isolated HOME/cache and a fake provider: no account credentials or network.
function withCli(run: (invoke: (args: string[], extra?: NodeJS.ProcessEnv) => SpawnSyncReturns<string>, home: string) => void) {
  const home = mkdtempSync(path.join(tmpdir(), "ai-hp-json-"));
  try {
    mkdirSync(path.join(home, "bin"));
    writeFileSync(path.join(home, "bin", "claude"), `#!${process.execPath}\nprocess.exit(99);\n`, { mode: 0o755 });
    mkdirSync(path.join(home, ".codex"));
    writeFileSync(path.join(home, ".codex", "config.toml"), "");
    writeFileSync(path.join(home, "bin", "codex"), `#!${process.execPath}
const { createInterface } = require('node:readline');
createInterface({ input: process.stdin }).on('line', line => {
  const request = JSON.parse(line);
  if (request.id === 2) console.log(JSON.stringify({ id: 2, result: { account: process.env.FIXTURE_MODE === 'logged-out' ? null : { email: 'fixture@example.com', planType: 'pro' } } }));
  if (request.id === 3) console.log(JSON.stringify(process.env.FIXTURE_MODE === 'error'
    ? { id: 3, error: { message: 'offline' } }
    : { id: 3, result: { accountId: 'fixture', rateLimits: { primary: { usedPercent: process.env.FIXTURE_MODE === 'reset' ? 0 : 42, windowDurationMins: 10080, resetsAt: process.env.FIXTURE_MODE === 'reset' ? 1800000000 : 1790000000 } } } }));
});
`, { mode: 0o755 });
    const invoke = (args: string[], extra: NodeJS.ProcessEnv = {}) => spawnSync(process.execPath, [path.join(root, "skills/ai-hp/dist/cli.js"), ...args], {
      encoding: "utf8", timeout: 10_000,
      env: {
        HOME: home, PATH: path.join(home, "bin"), XDG_CONFIG_HOME: home,
        AI_HP_CACHE: path.join(home, "cache.json"), AI_HP_CODEX_HOMES: path.join(home, ".codex"),
        AI_HP_CLAUDE_DIRS: path.join(home, "no-claude-login"), AI_HP_LANG: "en", ...extra,
      },
    });
    run(invoke, home);
  } finally { rmSync(home, { recursive: true, force: true }); }
}

describe("CLI JSON integration", () => {
  it("stdout contains one JSON object even with display flags and debug; failures still carry cached data", () => withCli((invoke) => {
    const first = invoke(["--json", "--markdown", "--comment", "--debug", "--include-cached"]);
    assert.equal(first.error, undefined);
    assert.equal(first.status, 0);
    assert.equal(first.stdout.trim().split("\n").length, 1);
    const output = JSON.parse(first.stdout);
    assert.equal(output.accounts[0].email, "fixture@example.com");
    assert.equal(output.accounts[0].limits[0].usedPercent, 42);
    assert.equal(output.accounts[0].freshness, "fresh");
    assert.match(first.stderr, /ai-hp debug/);
    const failed = invoke(["--json", "--include-cached"], { FIXTURE_MODE: "error" });
    assert.equal(failed.status, 1);
    const fallback = JSON.parse(failed.stdout);
    assert.equal(fallback.status, "error");
    assert.equal(fallback.accounts[0].freshness, "cached");
    assert.ok(fallback.issues.some((issue: { code: string }) => issue.code === "collection_failed"));
    const freshOnly = invoke(["--json", "--fresh-only"], { FIXTURE_MODE: "error" });
    assert.equal(freshOnly.status, 1);
    const filtered = JSON.parse(freshOnly.stdout);
    assert.equal(filtered.accounts.length, 0);
    assert.ok(filtered.issues.length > 0);
    const defaultResult = invoke(["--json"], { FIXTURE_MODE: "error" });
    assert.equal(defaultResult.status, 1);
    assert.equal(JSON.parse(defaultResult.stdout).accounts.length, 0);
    const retained = invoke(["--json", "--include-cached"], { FIXTURE_MODE: "error" });
    assert.equal(JSON.parse(retained.stdout).accounts[0].freshness, "cached");
    const reset = invoke(["--json"], { FIXTURE_MODE: "reset" });
    assert.equal(reset.status, 0);
    const updated = JSON.parse(reset.stdout);
    assert.equal(updated.accounts[0].freshness, "fresh");
    assert.equal(updated.accounts[0].limits[0].usedPercent, 0);
    assert.equal(updated.accounts[0].limits[0].resetsAt, new Date(1800000000 * 1000).toISOString());
  }));

  it("reports logged-out accounts with stable reason codes and retains Markdown as the default", () => withCli((invoke) => {
    const loggedOut = invoke(["--json", "--lang", "ja"], { FIXTURE_MODE: "logged-out" });
    const output = JSON.parse(loggedOut.stdout);
    assert.equal(output.accounts.length, 0);
    assert.ok(output.excluded.some((entry: { code: string }) => entry.code === "not_logged_in_or_api_key"));
    const markdown = invoke([]);
    assert.equal(markdown.status, 0);
    assert.match(markdown.stdout, /^### AI HP/);
    assert.match(markdown.stdout, /fixture@example.com/);
  }));

  it("fatal setup failure still emits parseable JSON and a nonzero exit code", () => withCli((invoke, home) => {
    const failed = invoke(["--json"], { HOME: path.join(home, "missing-home") });
    assert.equal(failed.status, 1);
    const output = JSON.parse(failed.stdout);
    assert.equal(output.status, "error");
    assert.equal(output.issues[0].code, "fatal");
    assert.equal(output.accounts.length, 0);
  }));
});
