import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { pickCachedOnly, reviveSnapshot } from "../skills/ai-hp/scripts/cache.ts";
import { setLang } from "../skills/ai-hp/scripts/i18n.ts";
import { indicator, renderReport } from "../skills/ai-hp/scripts/report.ts";
import type { Snapshot } from "../skills/ai-hp/scripts/types.ts";

const TZ = "Asia/Tokyo";
const NOW = new Date("2026-09-25T05:00:00Z"); // 9/25(金) 14:00 JST

beforeEach(() => setLang("ja"));

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
  fetchedAt: NOW,
  sources: ["/Users/me/.claude"],
};

const codex: Snapshot = {
  provider: "codex",
  accountKey: "codex:acc:b@example.com",
  email: "b@example.com",
  plan: "pro",
  limits: [{ kind: "weekly", usedPercent: 100, resetsAt: new Date("2026-09-26T08:49:00Z") }],
  resetCredits: {
    available: 1,
    items: [{ title: "Full reset", count: 1, expiresAt: new Date("2026-10-22T21:01:24Z") }],
  },
  fetchedAt: NOW,
  sources: ["/Users/me/.codex-account-b"],
};

function render(over: Partial<Parameters<typeof renderReport>[0]> = {}): string {
  return renderReport({ fresh: [], cached: [], excluded: [], problems: [], now: NOW, host: "mac", timeZone: TZ, ...over });
}

function rowOf(out: string, email: string): string {
  const row = out.split("\n").find((l) => l.includes(email));
  assert.ok(row, `${email} の行がありません`);
  return row;
}

describe("renderReport（日本語）", () => {
  it("Claude は 1 行に週間・Fable の別枠・5 時間枠を並べる", () => {
    assert.equal(
      rowOf(render({ fresh: [claude] }), "a@example.com"),
      "| 9/27(日) 05:00（あと1日15時間） | Claude | a@example.com（max · .claude） | ████████░░ 83% | Fable 100% | 5時間 73%（9/25(金) 16:50） | 未取得 |",
    );
  });

  it("別枠のリセット日時が全体の週間枠と違えば併記する", () => {
    const shifted: Snapshot = {
      ...claude,
      limits: [claude.limits[0], { kind: "scoped", scope: "Fable", usedPercent: 40, resetsAt: new Date("2026-09-28T03:00:00Z") }],
    };
    assert.match(rowOf(render({ fresh: [shifted] }), "a@example.com"), /\| Fable 60%（9\/28\(月\) 12:00 リセット） \|/);
  });

  it("同じメールアドレスの個人と Team は別の行になる", () => {
    const team: Snapshot = { ...claude, accountKey: "claude:user-1:org-team", plan: "team", sources: ["/Users/me/.claude-a-team"] };
    const out = render({ fresh: [claude, team] });
    assert.equal(out.split("\n").filter((l) => l.includes("a@example.com")).length, 2);
    assert.match(out, /a@example\.com（team · \.claude-a-team）/);
  });

  it("Codex は Banked reset の数と失効日時を出し、残りが少ない枠は太字にする", () => {
    assert.equal(
      rowOf(render({ fresh: [codex] }), "b@example.com"),
      "| 9/26(土) 17:49（あと1日3時間） | Codex | b@example.com（pro · .codex-account-b） | ░░░░░░░░░░ **0%** | — | — | 1回（10/23(金) 06:01 失効） |",
    );
  });

  it("前回値は〔○時点〕を付け、リセットを過ぎていれば残り 100% の見込みにする", () => {
    const old: Snapshot = {
      ...claude,
      fetchedAt: new Date("2026-09-19T00:00:00Z"),
      limits: [{ kind: "weekly", usedPercent: 90, resetsAt: new Date("2026-09-20T00:00:00Z") }],
    };
    const out = render({ cached: [old] });
    assert.match(
      out,
      /\| 済（9\/20\(日\) 09:00） \| Claude \| a@example\.com（max · \.claude） 〔9\/19\(土\) 09:00 時点〕 \| ██████████ 100%（リセット済みの見込み） \|/,
    );
    assert.match(out, /前回値です/);
  });

  it("前回値のうち失効した Banked reset は数えない", () => {
    const expired: Snapshot = {
      ...codex,
      resetCredits: { available: 1, items: [{ title: "Full reset", count: 1, expiresAt: new Date("2026-09-24T00:00:00Z") }] },
    };
    assert.match(rowOf(render({ cached: [expired] }), "b@example.com"), /\| 0 \|$/);
  });

  it("付与単位ごとに残り回数を持つ Banked reset は、合計と付与ごとの使用期限を出す", () => {
    const withResets: Snapshot = {
      ...claude,
      resetCredits: {
        available: 3,
        items: [
          { title: "Gift", count: 1, expiresAt: new Date("2026-10-01T00:00:00Z"), paused: true },
          { title: "Weekly reset", count: 2, expiresAt: new Date("2026-10-10T00:00:00Z") },
        ],
      },
    };
    assert.match(
      rowOf(render({ fresh: [withResets] }), "a@example.com"),
      /\| 3回（Gift · 10\/1\(木\) 09:00 失効 · 一時停止中、Weekly reset · 2回 · 10\/10\(土\) 09:00 失効） \|$/,
    );
  });

  it("Banked reset の長い名前は「:」より前だけ出す", () => {
    const launch: Snapshot = {
      ...claude,
      resetCredits: {
        available: 1,
        items: [
          {
            title: "Claude Opus 5.5 launch: one usage-limit reset for Team members",
            count: 1,
            expiresAt: new Date("2026-10-22T16:00:00Z"),
          },
        ],
      },
    };
    assert.match(
      rowOf(render({ fresh: [launch] }), "a@example.com"),
      /\| 1回（Claude Opus 5\.5 launch · 10\/23\(金\) 01:00 失効） \|$/,
    );
  });

  it("Banked reset の対象外は 0 と理由を出す", () => {
    const ineligible: Snapshot = { ...claude, resetCredits: { available: 0, items: [], note: "プラン対象外" } };
    assert.match(rowOf(render({ fresh: [ineligible] }), "a@example.com"), /\| 0（プラン対象外） \|$/);
  });

  it("Claude の Banked reset は取得しないので「—」と注記を出す", () => {
    const off: Snapshot = { ...claude, resetCreditsOff: true };
    const out = render({ fresh: [off] });
    assert.match(rowOf(out, "a@example.com"), /\| — \|$/);
    assert.match(out, /Claude の Banked reset は、Claude Code の窓口から取得できないため表示しません/);
    assert.doesNotMatch(out, /「未取得」/);
  });

  it("取得に失敗したフォルダと表示しなかったフォルダを表の下に出す", () => {
    const out = render({ fresh: [codex], excluded: [".codex-x（未ログイン）"], problems: [".codex-y — タイムアウト"] });
    assert.match(out, /- 表示していないフォルダ: \.codex-x（未ログイン）/);
    assert.match(out, /- 取得に失敗: \.codex-y — タイムアウト/);
  });

  it("サービスをまたいで週間リセットの近い順に並べ、リセット日時が未定・過ぎた前回値は最後に回す", () => {
    const later: Snapshot = {
      ...codex,
      accountKey: "k2",
      email: "c@example.com",
      limits: [{ kind: "weekly", usedPercent: 10, resetsAt: new Date("2026-09-29T00:00:00Z") }],
    };
    const notStarted: Snapshot = { ...codex, accountKey: "k3", email: "d@example.com", limits: [{ kind: "weekly", usedPercent: 0 }] };
    const passed: Snapshot = {
      ...claude,
      accountKey: "k4",
      email: "e@example.com",
      limits: [{ kind: "weekly", usedPercent: 50, resetsAt: new Date("2026-09-20T00:00:00Z") }],
    };
    // リセット: b=9/26 17:49 < a=9/27 05:00 < c=9/29 09:00。d（未開始）と e（過ぎた前回値）は最後
    const out = render({ fresh: [later, notStarted, claude, codex], cached: [passed] });
    const order = ["b@example.com", "a@example.com", "c@example.com"].map((e) => out.indexOf(e));
    assert.deepEqual([...order].sort((x, y) => x - y), order);
    const tail = ["d@example.com", "e@example.com"].map((e) => out.indexOf(e));
    assert.ok(Math.min(...tail) > Math.max(...order));
    assert.match(out, /\n\| 週間 リセット \| サービス \| アカウント \|/);
  });
});

describe("renderReport（英語）", () => {
  beforeEach(() => setLang("en"));

  it("見出し・日時・残り時間・Banked reset を英語で出す", () => {
    const out = render({ fresh: [claude, codex] });
    assert.match(out, /^### AI HP \(2026-09-25 14:00 · mac · soonest weekly reset first\)/);
    assert.match(out, /\n\| Weekly reset \| Service \| Account \| Weekly left \| Other weekly \| Short-term \| Banked resets \|/);
    assert.equal(
      rowOf(out, "a@example.com"),
      "| Sun 9/27 05:00 (in 1d 15h) | Claude | a@example.com (max · .claude) | ████████░░ 83% | Fable 100% | 5h 73% (Fri 9/25 16:50) | not fetched |",
    );
    assert.equal(
      rowOf(out, "b@example.com"),
      "| Sat 9/26 17:49 (in 1d 3h) | Codex | b@example.com (pro · .codex-account-b) | ░░░░░░░░░░ **0%** | — | — | 1 (expires Fri 10/23 06:01) |",
    );
  });

  it("前回値と注記も英語で出す", () => {
    const old: Snapshot = {
      ...claude,
      resetCreditsOff: true,
      fetchedAt: new Date("2026-09-19T00:00:00Z"),
      limits: [{ kind: "weekly", usedPercent: 90, resetsAt: new Date("2026-09-20T00:00:00Z") }],
    };
    const out = render({ cached: [old], excluded: [".codex-x (not logged in)"] });
    assert.match(out, /〔as of Sat 9\/19 09:00〕 \| ██████████ 100% \(likely reset\) \|/);
    assert.match(out, /- Claude’s banked resets are not shown/);
    assert.match(out, /- Not shown: \.codex-x \(not logged in\)/);
  });
});

describe("indicator", () => {
  it("残りを 10 マスで表す", () => {
    assert.equal(indicator(100), "██████████");
    assert.equal(indicator(83), "████████░░");
    assert.equal(indicator(50), "█████░░░░░");
    assert.equal(indicator(0), "░░░░░░░░░░");
  });

  it("わずかでも残っていれば 1 マス塗り、少しでも使っていれば満タンにしない", () => {
    assert.equal(indicator(1), "█░░░░░░░░░");
    assert.equal(indicator(99), "█████████░");
  });
});

describe("cache", () => {
  it("保存した JSON から日時と枠の種類を復元できる", () => {
    const revived = reviveSnapshot(JSON.parse(JSON.stringify(claude)));
    assert.deepEqual(
      revived?.limits.map((l) => [l.kind, l.scope, l.windowHours, l.resetsAt?.toISOString()]),
      [
        ["weekly", undefined, undefined, "2026-09-26T20:00:00.000Z"],
        ["scoped", "Fable", undefined, "2026-09-26T20:00:00.000Z"],
        ["short", undefined, 5, "2026-09-25T07:50:00.000Z"],
      ],
    );
    assert.equal(reviveSnapshot(JSON.parse(JSON.stringify(codex)))?.resetCredits?.items[0].expiresAt?.toISOString(), "2026-10-22T21:01:24.000Z");
  });

  it("今回取れたアカウントと 14 日より古い値は前回値として使わない", () => {
    const stale: Snapshot = { ...claude, accountKey: "claude:user-2:org", fetchedAt: new Date("2026-09-20T00:00:00Z") };
    const tooOld: Snapshot = { ...claude, accountKey: "claude:user-3:org", fetchedAt: new Date("2026-09-01T00:00:00Z") };
    const picked = pickCachedOnly([claude, stale, tooOld], [claude], NOW);
    assert.deepEqual(
      picked.map((s) => s.accountKey),
      ["claude:user-2:org"],
    );
  });
});
