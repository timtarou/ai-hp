import path from "node:path";
import { getLang, t } from "./i18n.js";
import { formatDateTime, formatFullDateTime, formatRemaining } from "./time.js";
const PROVIDER_NAME = { claude: "Claude", codex: "Codex" };
const PROVIDER_ORDER = { claude: 0, codex: 1 };
/** 別枠のリセット日時が全体の週間枠とこれ以上ずれていれば別に表示する */
const SAME_RESET_TOLERANCE_MS = 5 * 60_000;
const BAR_CELLS = 10;
export function remainingPercent(usedPercent) {
    return Math.max(0, Math.min(100, Math.round(100 - usedPercent)));
}
/**
 * 残りを 10 マスの棒で表す。わずかでも残っていれば 1 マスは塗り、少しでも使っていれば満タンにしない
 * （0 と 100 の見た目は本当に 0% / 100% のときだけ）。
 */
export function indicator(remainingPct) {
    let filled = Math.round(remainingPct / (100 / BAR_CELLS));
    if (remainingPct > 0)
        filled = Math.max(filled, 1);
    if (remainingPct < 100)
        filled = Math.min(filled, BAR_CELLS - 1);
    return "█".repeat(filled) + "░".repeat(BAR_CELLS - filled);
}
function percentText(r) {
    return r < 20 ? `**${r}%**` : `${r}%`;
}
function paren(s) {
    return getLang() === "ja" ? `（${s}）` : ` (${s})`;
}
/** 前回値でリセット日時を過ぎていれば、残りは 100% に戻っている見込み */
function likelyReset(limit, stale, now) {
    return stale && !!limit.resetsAt && limit.resetsAt <= now;
}
function remaining(limit, stale, now) {
    if (likelyReset(limit, stale, now))
        return `100%${paren(t("likelyReset"))}`;
    return percentText(remainingPercent(limit.usedPercent));
}
/** 週間 残りの列: 棒 + 数字 */
function weeklyRemaining(limit, stale, now) {
    if (likelyReset(limit, stale, now))
        return `${indicator(100)} 100%${paren(t("likelyReset"))}`;
    const r = remainingPercent(limit.usedPercent);
    return `${indicator(r)} ${percentText(r)}`;
}
function resetText(limit, now, timeZone) {
    if (!limit.resetsAt)
        return t("notStarted");
    if (limit.resetsAt <= now)
        return t("resetDone", { time: formatDateTime(limit.resetsAt, timeZone) });
    return `${formatDateTime(limit.resetsAt, timeZone)}${paren(formatRemaining(now, limit.resetsAt))}`;
}
/** Fable などモデル別の週間枠。リセット日時が全体の週間枠と同じなら省く */
function scopedCell(s, weekly, stale, now, timeZone) {
    const scoped = s.limits.filter((l) => l.kind === "scoped");
    if (scoped.length === 0)
        return "—";
    return scoped
        .map((l) => {
        const sameReset = l.resetsAt &&
            weekly?.resetsAt &&
            Math.abs(l.resetsAt.getTime() - weekly.resetsAt.getTime()) < SAME_RESET_TOLERANCE_MS;
        const when = !l.resetsAt
            ? t("notStarted")
            : l.resetsAt <= now
                ? t("resetPassedShort")
                : t("resetAt", { time: formatDateTime(l.resetsAt, timeZone) });
        return `${l.scope ?? "?"} ${remaining(l, stale, now)}${sameReset ? "" : paren(when)}`;
    })
        .join(getLang() === "ja" ? "、" : ", ");
}
/** 5 時間枠など週間より短い枠 */
function shortTermCell(s, stale, now, timeZone) {
    const short = s.limits.filter((l) => l.kind === "short");
    if (short.length === 0)
        return "—";
    return short
        .map((l) => {
        const when = !l.resetsAt
            ? t("notStarted")
            : l.resetsAt <= now
                ? t("resetDoneShort")
                : formatDateTime(l.resetsAt, timeZone);
        return `${t("hoursWindow", { h: l.windowHours ?? "?" })} ${remaining(l, stale, now)}${paren(when)}`;
    })
        .join(getLang() === "ja" ? "、" : ", ");
}
/** 付与の名前は長い（例: "Claude Opus 5.5 launch: one usage-limit reset for Team members"）ので「:」より前だけ出す */
function shortTitle(title) {
    if (title === "Full reset" || title === "reset")
        return undefined;
    const head = title.split(":")[0].trim();
    return head.length > 40 ? `${head.slice(0, 39)}…` : head;
}
function creditsCell(s, now, timeZone) {
    if (s.resetCreditsOff)
        return t("bankedUnsupported"); // 0 件と区別できるよう「—」だけにしない
    if (!s.resetCredits)
        return t("bankedNotFetched");
    const { items, available, note } = s.resetCredits;
    const usable = items.filter((i) => !i.expiresAt || i.expiresAt > now);
    // 前回値では失効済みのものを数えない。明細が無い場合はサーバーの保有数を使う
    const count = items.length > 0 ? usable.reduce((sum, i) => sum + i.count, 0) : available;
    if (count === 0)
        return note ? `0${paren(note)}` : "0";
    const details = usable.map((i) => [
        shortTitle(i.title),
        usable.length > 1 && i.count > 1 ? t("bankedTimes", { n: i.count }) : undefined,
        i.startsAt && i.startsAt > now ? t("startsFrom", { time: formatDateTime(i.startsAt, timeZone) }) : undefined,
        i.expiresAt ? t("expires", { time: formatDateTime(i.expiresAt, timeZone) }) : t("noExpiry"),
        i.paused ? t("paused") : undefined,
    ]
        .filter(Boolean)
        .join(" · "));
    const total = t("bankedCount", { n: count });
    return details.length > 0 ? `${total}${paren(details.join(getLang() === "ja" ? "、" : "; "))}` : total;
}
function accountCell(s, stale, timeZone) {
    const detail = [s.plan, s.sources.map((p) => path.basename(p)).join(" / ")].filter(Boolean).join(" · ");
    const staleNote = stale ? ` 〔${t("staleAt", { time: formatDateTime(s.fetchedAt, timeZone) })}〕` : "";
    return `${s.email}${paren(detail)}${staleNote}`;
}
/**
 * 週間リセットの近い順（サービスをまたいで並べる）。リセット日時が未定の行と、
 * 前回値でリセット日時を過ぎた行（次のリセットが分からない）は最後に回す。
 */
function sortKey(s, now) {
    const reset = s.limits.find((l) => l.kind === "weekly")?.resetsAt;
    const upcoming = reset && reset > now ? reset.getTime() : Number.POSITIVE_INFINITY;
    return [upcoming, PROVIDER_ORDER[s.provider], s.email];
}
function compare(a, b) {
    return a[0] - b[0] || a[1] - b[1] || a[2].localeCompare(b[2]);
}
/** 取得結果を Markdown の表にする。1 アカウント 1 行で、Fable 等の別枠と短期枠は専用の列に出す */
export function renderReport(input) {
    const { now, timeZone } = input;
    const rows = [
        ...input.fresh.map((s) => ({ s, stale: false })),
        ...input.cached.map((s) => ({ s, stale: true })),
    ].sort((a, b) => compare(sortKey(a.s, now), sortKey(b.s, now)));
    const headers = [t("hReset"), t("hService"), t("hAccount"), t("hWeekly"), t("hScoped"), t("hShort"), t("hBanked")];
    const lines = [
        `### ${t("title", { time: formatFullDateTime(now, timeZone), host: input.host })}`,
        "",
        `| ${headers.join(" | ")} |`,
        `|${headers.map(() => "---").join("|")}|`,
    ];
    for (const { s, stale } of rows) {
        const weekly = s.limits.find((l) => l.kind === "weekly");
        const cells = [
            weekly ? resetText(weekly, now, timeZone) : "—",
            PROVIDER_NAME[s.provider],
            accountCell(s, stale, timeZone),
            weekly ? weeklyRemaining(weekly, stale, now) : "—",
            scopedCell(s, weekly, stale, now, timeZone),
            shortTermCell(s, stale, now, timeZone),
            creditsCell(s, now, timeZone),
        ];
        lines.push(`| ${cells.join(" | ")} |`);
    }
    if (rows.length === 0)
        lines.push(`| — | — | ${t("noAccounts")} | | | | |`);
    if (input.comment)
        lines.push("", `> 💬 ${input.comment}`);
    const notes = [];
    if (input.cached.length > 0)
        notes.push(t("noteStale"));
    if (rows.some((r) => !r.s.resetCredits && !r.s.resetCreditsOff))
        notes.push(t("noteNotFetched"));
    if (rows.some((r) => r.s.resetCreditsOff))
        notes.push(t("noteBankedOff"));
    if (input.excluded.length > 0)
        notes.push(t("noteExcluded", { list: input.excluded.join(getLang() === "ja" ? "、" : ", ") }));
    for (const p of input.problems)
        notes.push(t("noteFailed", { detail: p }));
    if (notes.length > 0)
        lines.push("", ...notes.map((n) => `- ${n}`));
    return lines.join("\n");
}
