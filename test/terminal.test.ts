import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { setLang } from "../skills/ai-hp/scripts/i18n.ts";
import { buildReport, type ReportModel } from "../skills/ai-hp/scripts/report.ts";
import { displayWidth, renderTerminal } from "../skills/ai-hp/scripts/terminal.ts";
import type { Snapshot } from "../skills/ai-hp/scripts/types.ts";

const TZ = "Asia/Tokyo";
const NOW = new Date("2026-09-25T05:00:00Z");
const ANSI = /\x1b\[[0-9;]*m/g;

beforeEach(() => setLang("en"));

const claude: Snapshot = {
  provider: "claude",
  accountKey: "claude:user-1:org-personal",
  email: "a@example.com",
  plan: "max",
  limits: [
    { kind: "weekly", usedPercent: 17, resetsAt: new Date("2026-09-26T20:00:00Z") },
    { kind: "scoped", scope: "Fable", usedPercent: 0, resetsAt: new Date("2026-09-26T20:00:00Z") },
    { kind: "short", windowHours: 5, usedPercent: 27, resetsAt: new Date("2026-09-25T07:50:00Z") },
  ],
  resetCreditsOff: true,
  fetchedAt: NOW,
  sources: ["/Users/me/.claude"],
};

const codex: Snapshot = {
  provider: "codex",
  accountKey: "codex:acc:b@example.com",
  email: "b@example.com",
  plan: "pro",
  limits: [{ kind: "weekly", usedPercent: 100, resetsAt: new Date("2026-09-26T08:49:00Z") }],
  resetCredits: { available: 1, items: [{ title: "Full reset", count: 1, expiresAt: new Date("2026-10-22T21:01:24Z") }] },
  fetchedAt: NOW,
  sources: ["/Users/me/.codex-work"],
};

function model(): ReportModel {
  return buildReport({ fresh: [claude, codex], cached: [], excluded: [], problems: [], now: NOW, host: "mac", timeZone: TZ });
}

/** 各行で、ある文字列が始まる桁（表示幅） */
function columnOf(line: string, text: string): number {
  const i = line.indexOf(text);
  assert.ok(i >= 0, `${text} がありません: ${line}`);
  return displayWidth(line.slice(0, i));
}

describe("displayWidth", () => {
  it("半角は 1 桁、全角と絵文字は 2 桁、結合文字は 0 桁", () => {
    assert.equal(displayWidth("abc 80%"), 7);
    assert.equal(displayWidth("週間 残り"), 9);
    assert.equal(displayWidth("（あと1日）"), 11);
    assert.equal(displayWidth("💬"), 2);
    assert.equal(displayWidth("é"), 1);
    assert.equal(displayWidth("████░░ —"), 8);
  });
});

describe("renderTerminal", () => {
  it("幅が足りれば列をそろえた表にし、Markdown の記号を残さない", () => {
    const out = renderTerminal(model(), { columns: 200, color: false });
    const lines = out.split("\n");
    assert.equal(lines[0], "AI HP (2026-09-25 14:00 · mac · soonest weekly reset first)");
    const header = lines[2];
    const codexRow = lines.find((l) => l.includes("b@example.com"))!;
    const claudeRow = lines.find((l) => l.includes("a@example.com"))!;
    for (const [head, codexCell, claudeCell] of [
      ["Service", "Codex", "Claude"],
      ["Account", "b@example.com", "a@example.com"],
      ["Weekly left", "░░░░░░░░░░ 0%", "████████░░ 83%"],
      ["Banked resets", "1 (expires", "— (not supported)"],
    ]) {
      assert.equal(columnOf(codexRow, codexCell), columnOf(header, head), head);
      assert.equal(columnOf(claudeRow, claudeCell), columnOf(header, head), head);
    }
    assert.ok(lines.indexOf(codexRow) < lines.indexOf(claudeRow), "週間リセットの近い順");
    assert.doesNotMatch(out, /\*\*|\||###/);
    assert.doesNotMatch(out, ANSI);
  });

  it("幅が足りなければアカウントごとに縦に並べ、値の無い項目は省く", () => {
    const out = renderTerminal(model(), { columns: 60, color: false });
    assert.match(out, /^Codex {2}b@example\.com \(pro · \.codex-work\)$/m);
    assert.match(out, /^ {2}Weekly left {4}░░░░░░░░░░ 0%$/m);
    assert.match(out, /^ {2}Banked resets {2}1 \(expires Fri 10\/23 06:01\)$/m);
    const codexCard = out.split("\n\n").find((c) => c.includes("b@example.com"))!;
    assert.doesNotMatch(codexCard, /Other weekly|Short-term/);
  });

  it("日本語の見出し（全角）でも列がそろう", () => {
    setLang("ja");
    const lines = renderTerminal(model(), { columns: 250, color: false }).split("\n");
    const header = lines[2];
    const row = lines.find((l) => l.includes("a@example.com"))!;
    assert.equal(columnOf(row, "a@example.com"), columnOf(header, "アカウント"));
    assert.equal(columnOf(row, "—（非対応）"), columnOf(header, "Banked reset"));
  });

  it("色を付けるときは、残りの少ない値を赤の太字にし、棒を残量で色分けする", () => {
    const out = renderTerminal(model(), { columns: 200, color: true });
    assert.ok(out.includes("\x1b[31m\x1b[1m0%\x1b[22m\x1b[39m"), "0% は赤の太字");
    assert.ok(out.includes("\x1b[32m████████\x1b[39m"), "83% の棒は緑");
    // 色を外すと、色なしの出力と同じになる
    assert.equal(out.replace(ANSI, ""), renderTerminal(model(), { columns: 200, color: false }));
  });

  it("アカウントが無ければその旨を出す", () => {
    const empty = buildReport({ fresh: [], cached: [], excluded: [], problems: [], now: NOW, host: "mac", timeZone: TZ });
    assert.match(renderTerminal(empty, { columns: 100, color: false }), /^no accounts found$/m);
  });
});
