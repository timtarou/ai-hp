import { collectionExitCode } from "./collect.js";
function iso(date) {
    return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function account(snapshot, freshness) {
    const credits = snapshot.resetCredits;
    return {
        provider: snapshot.provider,
        accountKey: snapshot.accountKey,
        email: snapshot.email,
        plan: snapshot.plan ?? null,
        sources: snapshot.sources,
        fetchedAt: iso(snapshot.fetchedAt),
        freshness,
        warning: snapshot.warning ?? null,
        limits: snapshot.limits.map((limit) => ({
            kind: limit.kind,
            scope: limit.scope ?? null,
            windowHours: limit.windowHours ?? null,
            usedPercent: limit.usedPercent,
            resetsAt: iso(limit.resetsAt),
        })),
        resetCredits: snapshot.resetCreditsOff
            ? { status: "unsupported", available: null, items: [], note: null }
            : !credits
                ? { status: "unknown", available: null, items: [], note: null }
                : {
                    status: "available",
                    available: credits.available,
                    note: credits.note ?? null,
                    items: credits.items.map((item) => ({
                        title: item.title,
                        count: item.count,
                        grantedAt: iso(item.grantedAt),
                        startsAt: iso(item.startsAt),
                        expiresAt: iso(item.expiresAt),
                        paused: item.paused ?? false,
                    })),
                },
    };
}
/** 未加工の取得値を返す。期限を過ぎても残量やリセット権の数を推測しない。 */
export function buildJsonOutput(result) {
    const accounts = [
        ...result.fresh.map((snapshot) => account(snapshot, "fresh")),
        ...result.cached.map((snapshot) => account(snapshot, "cached")),
    ];
    const nextReset = (entry) => {
        const date = entry.limits.find((limit) => limit.kind === "weekly")?.resetsAt;
        const time = date ? Date.parse(date) : Infinity;
        return time > result.now.getTime() ? time : Infinity;
    };
    accounts.sort((a, b) => nextReset(a) - nextReset(b)
        || a.provider.localeCompare(b.provider) || a.email.localeCompare(b.email) || a.accountKey.localeCompare(b.accountKey));
    const exitCode = collectionExitCode(result);
    const status = exitCode === 1 ? "error"
        : result.issues.length || result.cached.length ? "partial"
            : accounts.length ? "ok" : "empty";
    return {
        schemaVersion: 1,
        generatedAt: iso(result.now),
        status,
        exitCode,
        accounts,
        excluded: result.excluded.map(({ provider, source, code, skipped }) => ({ provider, source, code, message: skipped })),
        issues: result.issues,
    };
}
