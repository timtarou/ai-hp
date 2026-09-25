import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { parseClaudeUsage } from "../skills/ai-hp/scripts/collect/claude.ts";
import { parseCodexRateLimits, pickWindows } from "../skills/ai-hp/scripts/collect/codex.ts";
import { setLang } from "../skills/ai-hp/scripts/i18n.ts";

beforeEach(() => setLang("ja"));

// 2026-09-25 に claude 2.1.282 の get_usage から得た応答（必要な部分のみ）
const claudeUsage = {
  subscription_type: "max",
  rate_limits_available: true,
  rate_limits: {
    five_hour: { utilization: 22, resets_at: "2026-09-25T07:49:59.893836+00:00" },
    seven_day: { utilization: 15, resets_at: "2026-09-26T19:59:59.893858+00:00" },
    limits: [
      { kind: "session", group: "session", percent: 22, resets_at: "2026-09-25T07:49:59.893836+00:00", scope: null },
      { kind: "weekly_all", group: "weekly", percent: 15, resets_at: "2026-09-26T19:59:59.893858+00:00", scope: null },
      {
        kind: "weekly_scoped",
        group: "weekly",
        percent: 0,
        resets_at: "2026-09-26T20:00:00+00:00",
        scope: { model: { id: null, display_name: "Fable" }, surface: null },
      },
    ],
  },
};

// 2026-09-25 に codex 0.157.0 の account/rateLimits/read から得た応答（Banked reset あり）
const codexResult = {
  accountId: "acc-1",
  rateLimits: {
    limitId: "codex",
    primary: { usedPercent: 100, windowDurationMins: 10080, resetsAt: 1790758140 },
    secondary: null,
    planType: "pro",
  },
  rateLimitsByLimitId: {
    codex: { limitId: "codex", primary: { usedPercent: 100, windowDurationMins: 10080, resetsAt: 1790758140 } },
  },
  rateLimitResetCredits: {
    availableCount: 1,
    credits: [
      {
        id: "RateLimitResetCredit_x",
        resetType: "codexRateLimits",
        status: "available",
        grantedAt: 1790110884,
        expiresAt: 1792702884,
        title: "Full reset",
      },
      { id: "used", status: "redeemed", expiresAt: 1792000000, title: "Full reset" },
    ],
  },
};

describe("parseClaudeUsage", () => {
  it("全体の週間枠・Fable の別枠・5 時間枠をこの順に並べる", () => {
    const r = parseClaudeUsage(claudeUsage);
    assert.ok(!("skipped" in r));
    assert.equal(r.plan, "max");
    assert.deepEqual(
      r.limits.map((l) => [l.kind, l.scope ?? l.windowHours ?? null, l.usedPercent, l.resetsAt?.toISOString()]),
      [
        ["weekly", null, 15, "2026-09-26T19:59:59.893Z"],
        ["scoped", "Fable", 0, "2026-09-26T20:00:00.000Z"],
        ["short", 5, 22, "2026-09-25T07:49:59.893Z"],
      ],
    );
  });

  it("limits が無い古い形式でも週間と 5 時間を読む", () => {
    const { limits: _, ...old } = claudeUsage.rate_limits;
    const r = parseClaudeUsage({ ...claudeUsage, rate_limits: old });
    assert.ok(!("skipped" in r));
    assert.deepEqual(
      r.limits.map((l) => l.kind),
      ["weekly", "short"],
    );
  });

  it("API キー利用などプラン枠が無い場合は対象外にする（理由は表示言語で返す）", () => {
    assert.deepEqual(parseClaudeUsage({ rate_limits_available: false, rate_limits: null }), {
      skipped: "プラン枠の対象外（API キー利用など）",
    });
    setLang("en");
    assert.deepEqual(parseClaudeUsage({ rate_limits_available: false, rate_limits: null }), {
      skipped: "no plan limits (API key or similar)",
    });
  });
});

describe("parseCodexRateLimits", () => {
  it("使える Banked reset だけを失効日時つきで返す", () => {
    const r = parseCodexRateLimits(codexResult);
    assert.equal(r.resetCredits?.available, 1);
    assert.deepEqual(
      r.resetCredits?.items.map((i) => [i.title, i.count, i.expiresAt?.toISOString()]),
      [["Full reset", 1, "2026-10-22T21:01:24.000Z"]],
    );
    assert.deepEqual(
      r.limits.map((l) => [l.kind, l.usedPercent]),
      [["weekly", 100]],
    );
  });

  it("rateLimitResetCredits が無ければ不明（undefined）にする", () => {
    const { rateLimitResetCredits: _, ...rest } = codexResult;
    assert.equal(parseCodexRateLimits(rest).resetCredits, undefined);
  });

  it("既定以外の枠は別枠として週間の後に並べる", () => {
    const r = parseCodexRateLimits({
      ...codexResult,
      rateLimitsByLimitId: {
        ...codexResult.rateLimitsByLimitId,
        other: { limitName: "GPT-5.5", primary: { usedPercent: 30, windowDurationMins: 10080, resetsAt: 1790758140 } },
      },
    });
    assert.deepEqual(
      r.limits.map((l) => [l.kind, l.scope]),
      [
        ["weekly", undefined],
        ["scoped", "GPT-5.5"],
      ],
    );
  });
});

describe("pickWindows (Codex)", () => {
  it("Plus のように primary が 5 時間・secondary が週間の場合", () => {
    const w = pickWindows({
      primary: { usedPercent: 30, windowDurationMins: 300, resetsAt: 1790000000 },
      secondary: { usedPercent: 12, windowDurationMins: 10080, resetsAt: 1790500000 },
    });
    assert.equal(w.weekly?.usedPercent, 12);
    assert.equal(w.shortTerm?.usedPercent, 30);
  });

  it("周期が始まっていない枠はリセット日時なしで返す", () => {
    const w = pickWindows({ primary: { usedPercent: 0, windowDurationMins: 10080, resetsAt: null } });
    assert.equal(w.weekly?.usedPercent, 0);
    assert.equal(w.weekly?.resetsAt, undefined);
  });
});
