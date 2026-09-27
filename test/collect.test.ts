import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectUsage, collectionExitCode } from "../skills/ai-hp/scripts/collect.ts";
import type { Snapshot } from "../skills/ai-hp/scripts/types.ts";

const now = new Date("2026-09-26T12:00:00Z");
function snapshot(key = "codex:test"): Snapshot {
  return {
    provider: "codex", accountKey: key, email: "test@example.com", sources: ["/fixture/.codex"],
    fetchedAt: now, limits: [{ kind: "weekly", usedPercent: 42 }],
  };
}

function dependencies() {
  return {
    detectSources: async () => ({ claudeDirs: ["/fixture/.claude"], codexHomes: ["/fixture/.codex"] }),
    findExecutable: (name: string) => `/fixture/bin/${name}`,
    prepareWorkDir: async () => "/fixture/work",
    collectClaude: async (): Promise<Snapshot> => ({ ...snapshot("claude:test"), provider: "claude", sources: ["/fixture/.claude"] }),
    collectCodex: async (): Promise<Snapshot> => snapshot(),
    loadCache: async (): Promise<Snapshot[]> => [],
    saveCache: async (_snapshots: Snapshot[]) => {},
    now: () => now,
  };
}

describe("collectUsage", () => {
  it("one provider's failure preserves fresh data and recovers only unexpired missing accounts", async () => {
    const oldClaude = { ...snapshot("claude:test"), provider: "claude" as const };
    let saved: Snapshot[] = [];
    const result = await collectUsage({
      ...dependencies(),
      collectClaude: async () => { throw new Error("offline"); },
      loadCache: async () => [oldClaude, snapshot(), { ...snapshot("expired"), fetchedAt: new Date("2026-09-01") }],
      saveCache: async (values) => { saved = values; },
    }, { includeCached: true });
    assert.deepEqual(result.fresh.map((s) => s.accountKey), ["codex:test"]);
    assert.deepEqual(result.cached, [oldClaude]);
    assert.deepEqual(saved, [...result.fresh, oldClaude]);
    assert.deepEqual(result.issues, [{ code: "collection_failed", provider: "claude", sources: ["/fixture/.claude"], message: "offline" }]);
    assert.equal(collectionExitCode(result), 0);
  });

  it("missing CLI is structured, retains cache, and exits with failure if nothing fresh is available", async () => {
    const result = await collectUsage({ ...dependencies(), findExecutable: () => undefined, loadCache: async () => [snapshot()] }, { includeCached: true });
    assert.deepEqual(result.issues.map((issue) => [issue.code, issue.provider]), [["command_not_found", "claude"], ["command_not_found", "codex"]]);
    assert.equal(result.cached.length, 1);
    assert.equal(result.fresh.length, 0);
    assert.equal(collectionExitCode(result), 1);
  });

  it("a logged-out account is excluded, rather than represented as zero usage or a collection failure", async () => {
    const result = await collectUsage({
      ...dependencies(), detectSources: async () => ({ claudeDirs: ["/fixture/.claude"], codexHomes: [] }),
      collectClaude: async () => ({ skipped: "not logged in", code: "not_logged_in", source: "/fixture/.claude" }),
    });
    assert.deepEqual(result.excluded, [{ provider: "claude", source: "/fixture/.claude", code: "not_logged_in", skipped: "not logged in" }]);
    assert.equal(result.fresh.length, 0);
    assert.equal(result.issues.length, 0);
    assert.equal(collectionExitCode(result), 0);
  });

  it("merges duplicate logins but keeps different organizations distinct", async () => {
    const result = await collectUsage({
      ...dependencies(), detectSources: async () => ({ claudeDirs: [], codexHomes: ["a", "b", "team"] }),
      collectCodex: async ({ home }) => ({
        ...snapshot(home === "team" ? "codex:team" : "codex:personal"), sources: [home],
        resetCredits: home === "a" ? { available: 0, items: [] } : undefined,
        fetchedAt: new Date(home === "a" ? "2026-09-26T11:00:00Z" : now),
      }),
    });
    assert.equal(result.fresh.length, 2);
    assert.deepEqual(result.fresh[0].sources, ["a", "b"]);
    assert.equal(result.fresh[0].resetCredits?.available, 0);
  });

  it("cache write failure leaves both fresh and previously loaded cached values usable", async () => {
    const result = await collectUsage({
      ...dependencies(), loadCache: async () => [snapshot("other")],
      saveCache: async () => { throw new Error("read-only cache"); },
    }, { includeCached: true });
    assert.equal(result.fresh.length, 2);
    assert.equal(result.cached.length, 1);
    assert.equal(result.issues[0].code, "cache_failed");
    assert.equal(collectionExitCode(result), 0);
  });

  it("by default neither reads nor writes cache, even when a provider fails", async () => {
    let cacheAccesses = 0;
    const result = await collectUsage({
      ...dependencies(),
      collectClaude: async () => { throw new Error("offline"); },
      loadCache: async () => { cacheAccesses++; return [snapshot("old")]; },
      saveCache: async () => { cacheAccesses++; },
    });
    assert.equal(cacheAccesses, 0);
    assert.deepEqual(result.cached, []);
    assert.equal(result.fresh.length, 1);
    assert.equal(result.issues[0].code, "collection_failed");
  });
});
