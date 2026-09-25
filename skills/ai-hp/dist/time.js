import { getLang, t } from "./i18n.js";
function parts(d, timeZone) {
    const format = new Intl.DateTimeFormat(getLang() === "ja" ? "ja-JP" : "en-US", {
        timeZone,
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        weekday: "short",
        hourCycle: "h23",
    });
    const out = {};
    for (const p of format.formatToParts(d))
        out[p.type] = p.value;
    return out; // formatToParts は上の 6 項目を必ず返す
}
function pad(s) {
    return s.padStart(2, "0");
}
/** ja: 9/27(日) 05:00 / en: Sun 9/27 05:00 */
export function formatDateTime(d, timeZone) {
    const p = parts(d, timeZone);
    const time = `${pad(p.hour)}:${pad(p.minute)}`;
    return getLang() === "ja" ? `${p.month}/${p.day}(${p.weekday}) ${time}` : `${p.weekday} ${p.month}/${p.day} ${time}`;
}
/** 2026-09-25 14:10 */
export function formatFullDateTime(d, timeZone) {
    const p = parts(d, timeZone);
    return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
}
/** ja: あと1日15時間 / en: in 1d 15h */
export function formatRemaining(from, to) {
    const minutes = Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000));
    const d = Math.floor(minutes / 1440);
    const h = Math.floor((minutes % 1440) / 60);
    const m = minutes % 60;
    if (d > 0)
        return t("inDaysHours", { d, h });
    if (h > 0)
        return t("inHoursMinutes", { h, m });
    return t("inMinutes", { m });
}
export function isValidTimeZone(tz) {
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
    }
    catch {
        return false;
    }
}
export function systemTimeZone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
