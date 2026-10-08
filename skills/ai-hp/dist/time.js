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
/** ja: 10/16(金) / en: Fri 10/16 */
export function formatDate(d, timeZone) {
    const p = parts(d, timeZone);
    return getLang() === "ja" ? `${p.month}/${p.day}(${p.weekday})` : `${p.weekday} ${p.month}/${p.day}`;
}
/** 表示するタイムゾーンでの暦日の差（今日なら 0） */
export function calendarDaysBetween(from, to, timeZone) {
    const day = (d) => {
        const p = parts(d, timeZone);
        return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)) / 86_400_000;
    };
    return day(to) - day(from);
}
/**
 * 毎月同じ日・同じ時刻に更新されるとして、now より後の最初の更新日時（anchor が未来ならそれ自身）。
 * その月に無い日（31 日など）は月末にずらし、翌月は元の日に戻す（Stripe の月払いと同じ）。
 */
export function nextMonthlyRenewal(anchor, now) {
    const y = anchor.getUTCFullYear();
    const m = anchor.getUTCMonth();
    const day = anchor.getUTCDate();
    const timeOfDay = anchor.getTime() - Date.UTC(y, m, day);
    // 古い anchor でも 1 か月ずつ数えずに済むよう、直前の月から調べる
    let k = Math.max(0, (now.getUTCFullYear() - y) * 12 + now.getUTCMonth() - m - 1);
    for (;; k++) {
        const lastDay = new Date(Date.UTC(y, m + k + 1, 0)).getUTCDate();
        const at = new Date(Date.UTC(y, m + k, Math.min(day, lastDay)) + timeOfDay);
        if (at > now)
            return at;
    }
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
