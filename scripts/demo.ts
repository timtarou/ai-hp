// 架空のアカウントで表を描く（README のスクリーンショット用。サーバーには問い合わせない）
//   node scripts/demo.ts [--lang en|ja] [--columns 160] [--markdown] [--no-color]
import { oneLiner } from "../skills/ai-hp/scripts/commentary.ts";
import { isLang, setLang } from "../skills/ai-hp/scripts/i18n.ts";
import { buildReport, renderMarkdown } from "../skills/ai-hp/scripts/report.ts";
import { renderTerminal } from "../skills/ai-hp/scripts/terminal.ts";
import type { Snapshot } from "../skills/ai-hp/scripts/types.ts";

const argv = process.argv.slice(2);
const option = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const lang = option("--lang") ?? "en";
setLang(isLang(lang) ? lang : "en");

const now = new Date("2026-09-25T16:02:00Z");
const at = (iso: string) => new Date(iso);

const fresh: Snapshot[] = [
  {
    provider: "codex",
    accountKey: "codex:work",
    email: "alex@company.com",
    plan: "pro",
    limits: [{ kind: "weekly", usedPercent: 100, resetsAt: at("2026-09-26T08:49:00Z") }],
    resetCredits: { available: 1, items: [{ title: "Full reset", count: 1, expiresAt: at("2026-10-22T21:01:00Z") }] },
    fetchedAt: now,
    sources: ["/home/alex/.codex-work"],
  },
  {
    provider: "claude",
    accountKey: "claude:personal",
    email: "alex@example.com",
    plan: "max",
    limits: [
      { kind: "weekly", usedPercent: 20, resetsAt: at("2026-09-26T19:59:00Z") },
      { kind: "scoped", scope: "Fable", usedPercent: 0, resetsAt: at("2026-09-26T19:59:00Z") },
      { kind: "short", windowHours: 5, usedPercent: 41, resetsAt: at("2026-09-25T18:49:00Z") },
    ],
    resetCreditsOff: true,
    fetchedAt: now,
    sources: ["/home/alex/.claude"],
  },
  {
    provider: "codex",
    accountKey: "codex:personal",
    email: "alex@example.com",
    plan: "plus",
    limits: [{ kind: "weekly", usedPercent: 83, resetsAt: at("2026-09-29T21:09:00Z") }],
    resetCredits: { available: 0, items: [] },
    fetchedAt: now,
    sources: ["/home/alex/.codex"],
  },
  {
    provider: "claude",
    accountKey: "claude:team",
    email: "alex@company.com",
    plan: "team",
    limits: [
      { kind: "weekly", usedPercent: 62, resetsAt: at("2026-09-30T23:00:00Z") },
      { kind: "scoped", scope: "Fable", usedPercent: 88, resetsAt: at("2026-09-30T23:00:00Z") },
      { kind: "short", windowHours: 5, usedPercent: 0 },
    ],
    resetCreditsOff: true,
    fetchedAt: now,
    sources: ["/home/alex/.claude-work"],
  },
];

const model = buildReport({
  fresh,
  cached: [],
  excluded: [],
  problems: [],
  now,
  host: "alex-mbp",
  timeZone: lang === "ja" ? "Asia/Tokyo" : "America/Los_Angeles",
  comment: argv.includes("--no-comment") ? undefined : oneLiner(fresh, now),
});
console.log(
  argv.includes("--markdown")
    ? renderMarkdown(model)
    : renderTerminal(model, {
        columns: Number(option("--columns") ?? process.stdout.columns ?? 160),
        color: !argv.includes("--no-color"),
      }),
);
