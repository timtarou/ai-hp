import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { oneLiner } from "../skills/ai-hp/scripts/commentary.ts";
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

function withCredit(s: Snapshot, expiresInHours: number): Snapshot {
  return { ...s, resetCredits: { available: 1, items: [{ title: "Full reset", count: 1, expiresAt: hoursLater(expiresInHours) }] } };
}

describe("oneLiner（表のあとの一言は 1 行だけ）", () => {
  it("リセットまで 24 時間以内で枠が残っていたら、ぶん回せと言う", () => {
    assert.equal(
      oneLiner([account({ email: "a@example.com", used: 20, resetInHours: 10 })], NOW, first),
      "Claude a は残り80%なのにリセットまであと10時間0分。宝箱を開けずにダンジョンを出る気か？ 急いでぶん回せ！",
    );
  });

  it("どれもほぼ枠がなく、回復が 1 日より先で Banked reset もなければ、課金をすすめる", () => {
    const out = oneLiner(
      [
        account({ email: "a@example.com", used: 100, resetInHours: 50 }),
        account({ provider: "codex", email: "b@example.com", used: 95, resetInHours: 30 }),
      ],
      NOW,
      first,
    );
    assert.equal(
      out,
      "どのアカウントもほぼ枠なし、次の回復まであと1日6時間。時間を買うなら追加クレジットかプランの格上げを。ただし課金は家賃まで。",
    );
  });

  it("全員 0% でも回復が 1 日以内なら、課金ではなく待てと言う", () => {
    const out = oneLiner([account({ email: "a@example.com", used: 100, resetInHours: 20 })], NOW, first);
    assert.equal(out, "全員 HP 0。へんじがない、ただのしかばねのようだ……。最初に復活するのは Claude a（リセットまであと20時間0分）。");
  });

  it("0% で Banked reset があり、自然なリセットが 2 日より先なら、使えと言う", () => {
    const out = oneLiner([withCredit(account({ provider: "codex", email: "b@example.com", used: 100, resetInHours: 72 }), 24 * 20)], NOW, first);
    assert.equal(out, "Codex b は HP 0 だけど Banked reset を1個持ってる。ザオリクを唱えるなら今！");
  });

  it("0% で Banked reset があっても、自然なリセットが 2 日以内なら温存と言う", () => {
    const out = oneLiner([withCredit(account({ provider: "codex", email: "b@example.com", used: 100, resetInHours: 30 }), 24 * 20)], NOW, first);
    assert.equal(out, "Codex b はあと1日6時間で宿屋（リセット）に着く。ザオリクは次の全滅まで温存で。");
  });

  it("Banked reset の失効が 7 日以内なら、使えと言う", () => {
    const out = oneLiner([withCredit(account({ provider: "codex", email: "b@example.com", used: 50, resetInHours: 72 }), 24 * 3)], NOW, first);
    assert.equal(out, "Codex b の Banked reset はあと3日0時間で失効。取っておいて腐らせるのは、エリクサー症候群の末期症状です。");
  });

  it("全体の枠が少なくても Fable の枠が残っていれば、別腹と言う（課金はすすめない）", () => {
    const low: Snapshot = {
      ...account({ email: "a@example.com", used: 90, resetInHours: 72 }),
      limits: [
        { kind: "weekly", usedPercent: 90, resetsAt: hoursLater(72) },
        { kind: "scoped", scope: "Fable", usedPercent: 0, resetsAt: hoursLater(72) },
      ],
    };
    assert.equal(oneLiner([low], NOW, first), "Claude a は本体が残り10%でも、Fable 枠はまだ100%。デザートは別腹です。");
  });

  it("赤ゲージのアカウントがあっても、元気なアカウントがあればそちらをすすめる", () => {
    const out = oneLiner(
      [
        account({ provider: "codex", email: "b@example.com", used: 83, resetInHours: 100 }),
        account({ email: "a@example.com", plan: "max", used: 70, resetInHours: 100 }),
        account({ email: "a@example.com", plan: "team", used: 10, resetInHours: 120 }),
      ],
      NOW,
      first,
    );
    assert.equal(out, "今いちばん元気なのは Claude a/team（残り90%）。君に決めた！");
  });

  it("元気なアカウントがなく赤ゲージがあれば、温存と言う", () => {
    const out = oneLiner(
      [account({ email: "a@example.com", used: 82, resetInHours: 72 }), account({ provider: "codex", email: "b@example.com", used: 60, resetInHours: 90 })],
      NOW,
      first,
    );
    assert.equal(out, "Claude a は HP 18%、リセットまであと3日0時間。作戦は『いのちだいじに』で。");
  });

  it("英語でも 1 行出す", () => {
    setLang("en");
    assert.equal(
      oneLiner([account({ email: "a@example.com", used: 20, resetInHours: 10 })], NOW, first),
      "Claude a still has 80% and resets in 10h 0m. Don't leave the dungeon with unopened chests — go full send!",
    );
  });

  it("アカウントがなければ何も出さない", () => {
    assert.equal(oneLiner([], NOW, first), undefined);
  });

  it("言い回しは候補の中から選ばれる", () => {
    const picks = new Set<string | undefined>();
    for (let i = 0; i < 4; i++) {
      picks.add(oneLiner([account({ email: "a@example.com", used: 20, resetInHours: 10 })], NOW, () => i));
    }
    assert.equal(picks.size, 4);
  });

  it("表のあとに 💬 付きで 1 行だけ出す", () => {
    const out = renderReport({
      fresh: [],
      cached: [],
      excluded: [],
      problems: [],
      comment: "一言",
      now: NOW,
      host: "mac",
      timeZone: "Asia/Tokyo",
    });
    assert.match(out, /\n\n> 💬 一言$/);
    assert.equal(out.split("\n").filter((l) => l.startsWith(">")).length, 1);
  });
});
