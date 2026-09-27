import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadCache, pickCachedOnly, saveCache } from "./cache.js";
import { collectClaude } from "./collect/claude.js";
import { collectCodex } from "./collect/codex.js";
import { detectSources, findExecutable } from "./detect.js";
export function describe(error) {
    return error instanceof Error ? error.message : String(error);
}
/** 同じアカウントの複数ログイン元をまとめる。リセット権を取得できた値を優先する。 */
function mergeByAccount(snapshots) {
    const byKey = new Map();
    for (const s of snapshots) {
        const prev = byKey.get(s.accountKey);
        if (!prev)
            byKey.set(s.accountKey, s);
        else {
            const preferS = !!s.resetCredits !== !!prev.resetCredits ? !!s.resetCredits : prev.fetchedAt < s.fetchedAt;
            const base = preferS ? s : prev;
            byKey.set(s.accountKey, { ...base, sources: [...new Set([...prev.sources, ...s.sources])] });
        }
    }
    return [...byKey.values()];
}
const defaults = {
    detectSources,
    findExecutable,
    collectClaude,
    collectCodex,
    loadCache,
    saveCache,
    now: () => new Date(),
    prepareWorkDir: async () => {
        const dir = path.join(tmpdir(), "ai-hp");
        await mkdir(dir, { recursive: true });
        return dir;
    },
};
/** 表示形式から独立した取得処理。依存の差し替えで実ログインなしに検証できる。 */
export async function collectUsage(overrides = {}, options = {}) {
    const deps = { ...defaults, ...overrides };
    const { claudeDirs, codexHomes } = await deps.detectSources();
    const workDir = await deps.prepareWorkDir();
    const issues = [];
    const tasks = [];
    for (const [provider, sources] of [["claude", claudeDirs], ["codex", codexHomes]]) {
        const bin = deps.findExecutable(provider);
        if (!bin) {
            if (sources.length)
                issues.push({ code: "command_not_found", provider, sources, message: `${provider}: command not found` });
            continue;
        }
        for (const source of sources)
            tasks.push({
                provider,
                source,
                run: () => provider === "claude"
                    ? deps.collectClaude({ configDir: source, claudeBin: bin, workDir })
                    : deps.collectCodex({ home: source, codexBin: bin, workDir }),
            });
    }
    const results = await Promise.allSettled(tasks.map(async (task) => task.run()));
    const collected = [];
    const excluded = [];
    results.forEach((result, i) => {
        const { provider, source } = tasks[i];
        if (result.status === "rejected")
            issues.push({
                code: "collection_failed", provider, sources: [source], message: describe(result.reason),
            });
        else if ("skipped" in result.value)
            excluded.push({ ...result.value, provider });
        else
            collected.push(result.value);
    });
    const fresh = mergeByAccount(collected);
    for (const snapshot of fresh) {
        if (snapshot.warning)
            issues.push({
                code: "account_warning", provider: snapshot.provider, sources: snapshot.sources, message: snapshot.warning,
            });
    }
    const now = deps.now();
    let cached = [];
    if (options.includeCached) {
        try {
            cached = pickCachedOnly(await deps.loadCache(), fresh, now);
            await deps.saveCache([...fresh, ...cached]);
        }
        catch (error) {
            issues.push({ code: "cache_failed", provider: null, sources: [], message: describe(error) });
        }
    }
    return { fresh, cached, excluded, issues, now };
}
/** 既存CLIと同じ: 新しい値が一件もなく問題がある場合のみ失敗。 */
export function collectionExitCode(result) {
    return result.fresh.length === 0 && result.issues.length > 0 ? 1 : 0;
}
export function failedCollection(error) {
    return {
        fresh: [], cached: [], excluded: [], now: new Date(),
        issues: [{ code: "fatal", provider: null, sources: [], message: describe(error) }],
    };
}
