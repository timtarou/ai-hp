import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { commentary } from "../skills/ai-hp/scripts/commentary.ts";
import { setLang } from "../skills/ai-hp/scripts/i18n.ts";
import { renderReport } from "../skills/ai-hp/scripts/report.ts";
import type { Snapshot } from "../skills/ai-hp/scripts/types.ts";

const NOW = new Date("2026-09-25T05:00:00Z"); // 9/25(金) 14:00 JST
const hoursLater = (h: number) => new Date(NOW.getTime() + h * 3_600_000);
const first = () => 0; // 言い回しは常に先頭の候補を選ぶ

beforeEach(() => setLang("ja"));

function account(over: Partial<Snapshot> & { email: string; used: number; resetInHours?: number }): Snapshot {
  const { used, resetInHours, ...rest } = over;
  return {
    provider: "claude",
    accountKey: `k:${over.email}:${over.plan ?? ""}`,
    plan: "max",
    limits: [{ kind: "weekly", usedPercent: used, resetsAt: resetInHours === undefined ? undefined : hoursLater(resetInHours) }],
    fetchedAt: NOW,
    sources: ["/Users/me/.claude"],
    ...rest,
  };
}

describe("commentary", () => {
  it("リセットまで 24 時間以内で枠が残っていたら、ぶん回せと言う", () => {
    const out = commentary([account({ email: "a@example.com", used: 20, resetInHours: 10 })], NOW, first);
    assert.deepEqual(out, [
      "Claude a は残り80%なのにリセットまであと10時間0分。宝箱を開けずにダンジョンを出る気か？ 急いでぶん回せ！",
      "今いちばん元気なのは Claude a（残り80%）。君に決めた！",
    ]);
  });

  it("全員 0% で回復も遠く Banked reset もなければ、全滅を告げて課金をすすめる", () => {
    const out = commentary(
      [
        account({ email: "a@example.com", used: 100, resetInHours: 50 }),
        account({ provider: "codex", email: "b@example.com", used: 100, resetInHours: 30 }),
      ],
      NOW,
      first,
    );
    assert.deepEqual(out, [
      "全員 HP 0。へんじがない、ただのしかばねのようだ……。最初に復活するのは Codex b（リセットまであと1日6時間）。",
      "どのアカウントもほぼ枠なし、次の回復まであと1日6時間。時間を買うなら追加クレジットかプランの格上げを。ただし課金は家賃まで。",
    ]);
  });

  it("回復が 24 時間以内なら課金はすすめない", () => {
    const out = commentary([account({ email: "a@example.com", used: 95, resetInHours: 20 })], NOW, first);
    assert.ok(!out.some((c) => c.includes("課金")));
  });

  it("0% でも Banked reset を持っていれば、課金より先にそれを使えと言う", () => {
    const out = commentary(
      [
        account({
          provider: "codex",
          email: "b@example.com",
          used: 100,
          resetInHours: 72,
          resetCredits: { available: 1, items: [{ title: "Full reset", count: 1, expiresAt: hoursLater(24 * 20) }] },
        }),
      ],
      NOW,
      first,
    );
    assert.equal(out[0], "Codex b は HP 0 だけど Banked reset を1個持ってる。ザオリクを唱えるなら今！");
    assert.ok(!out.some((c) => c.includes("課金")));
  });

  it("Banked reset の失効が 7 日以内なら、使えと言う", () => {
    const out = commentary(
      [
        account({
          provider: "codex",
          email: "b@example.com",
          used: 50,
          resetInHours: 72,
          resetCredits: { available: 1, items: [{ title: "Full reset", count: 1, expiresAt: hoursLater(24 * 3) }] },
        }),
      ],
      NOW,
      first,
    );
    assert.equal(out[0], "Codex b の Banked reset はあと3日0時間で失効。取っておいて腐らせるのは、エリクサー症候群の末期症状です。");
  });

  it("全体の枠が少なくても Fable の枠が残っていれば、別腹と言い、課金はすすめない", () => {
    const low: Snapshot = {
      ...account({ email: "a@example.com", used: 90, resetInHours: 72 }),
      limits: [
        { kind: "weekly", usedPercent: 90, resetsAt: hoursLater(72) },
        { kind: "scoped", scope: "Fable", usedPercent: 0, resetsAt: hoursLater(72) },
      ],
    };
    const out = commentary([low], NOW, first);
    assert.deepEqual(out, [
      "Claude a は本体が残り10%でも、Fable 枠はまだ100%。デザートは別腹です。",
      "Claude a は HP 10%、リセットまであと3日0時間。作戦は『いのちだいじに』で。",
    ]);
  });

  it("同じ呼び名のアカウント（個人と Team）はプランを添えて区別する", () => {
    const out = commentary(
      [
        account({ email: "a@example.com", plan: "max", used: 70, resetInHours: 100 }),
        account({ email: "a@example.com", plan: "team", used: 10, resetInHours: 120 }),
      ],
      NOW,
      first,
    );
    assert.deepEqual(out, ["今いちばん元気なのは Claude a/team（残り90%）。君に決めた！"]);
  });

  it("英語でも出す", () => {
    setLang("en");
    const out = commentary([account({ email: "a@example.com", used: 20, resetInHours: 10 })], NOW, first);
    assert.deepEqual(out, [
      "Claude a still has 80% and resets in 10h 0m. Don't leave the dungeon with unopened chests — go full send!",
      "Claude a (80% left) — I choose you!",
    ]);
  });

  it("言い回しは候補の中から選ばれる", () => {
    const picks = new Set<string>();
    for (let i = 0; i < 4; i++) {
      picks.add(commentary([account({ email: "a@example.com", used: 20, resetInHours: 10 })], NOW, () => i)[0]);
    }
    assert.equal(picks.size, 4);
  });

  it("表のあとに 💬 付きで出す", () => {
    const out = renderReport({
      fresh: [],
      cached: [],
      excluded: [],
      problems: [],
      comments: ["一言目", "二言目"],
      now: NOW,
      host: "mac",
      timeZone: "Asia/Tokyo",
    });
    assert.match(out, /\n\n> 💬 一言目\n>\n> 💬 二言目/);
  });
});
