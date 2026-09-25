import { t } from "../i18n.ts";
import { exchangeJsonLines } from "../jsonl-process.ts";
import { arr, num, obj, str, type Obj } from "../json.ts";
import { debugLog } from "../settings.ts";
import type { Limit, ResetCredit, Skipped, Snapshot } from "../types.ts";

const ACCOUNT_ID = 2;
const RATE_LIMITS_ID = 3;
const WEEK_MINUTES = 7 * 24 * 60;

type CodexWindow = { usedPercent: number; resetsAt?: Date; windowMins: number };

function epoch(v: unknown): Date | undefined {
  const n = num(v);
  return n === undefined ? undefined : new Date(n * 1000);
}

function toWindow(v: unknown): CodexWindow | undefined {
  const o = obj(v);
  const used = num(o?.usedPercent);
  const windowMins = num(o?.windowDurationMins);
  if (used === undefined || windowMins === undefined) return undefined;
  return { usedPercent: used, resetsAt: epoch(o?.resetsAt), windowMins };
}

/**
 * primary / secondary のどちらが週間枠かはプランで変わる（Pro は primary が週間、
 * Plus は primary が 5 時間で secondary が週間）ため、枠の長さで選ぶ。
 */
export function pickWindows(rateLimits: Obj | undefined): { weekly?: CodexWindow; shortTerm?: CodexWindow } {
  const windows = [toWindow(rateLimits?.primary), toWindow(rateLimits?.secondary)].filter(
    (w): w is CodexWindow => w !== undefined,
  );
  return {
    weekly: windows.find((w) => w.windowMins >= WEEK_MINUTES - 60),
    shortTerm: windows.find((w) => w.windowMins < WEEK_MINUTES - 60),
  };
}

/** account/rateLimits/read の応答を枠の一覧と Banked reset にする */
export function parseCodexRateLimits(result: Obj | undefined): {
  plan?: string;
  accountId?: string;
  limits: Limit[];
  resetCredits?: { available: number; items: ResetCredit[] };
} {
  const main = obj(result?.rateLimits);
  const { weekly, shortTerm } = pickWindows(main);
  const limits: Limit[] = [];
  if (weekly) limits.push({ kind: "weekly", usedPercent: weekly.usedPercent, resetsAt: weekly.resetsAt });

  // 既定以外の枠（モデル別など）があれば別枠として並べる
  for (const [limitId, other] of Object.entries(obj(result?.rateLimitsByLimitId) ?? {})) {
    if (limitId === str(main?.limitId)) continue;
    const w = pickWindows(obj(other)).weekly;
    const scope = str(obj(other)?.limitName) ?? limitId;
    if (w) limits.push({ kind: "scoped", scope, usedPercent: w.usedPercent, resetsAt: w.resetsAt });
  }
  if (shortTerm) {
    limits.push({
      kind: "short",
      windowHours: Math.round(shortTerm.windowMins / 60),
      usedPercent: shortTerm.usedPercent,
      resetsAt: shortTerm.resetsAt,
    });
  }

  const credits = obj(result?.rateLimitResetCredits);
  const items = arr(credits?.credits)
    .map(obj)
    .filter((c) => c !== undefined && c.status === "available")
    .map((c) => ({
      title: str(c?.title) ?? str(c?.resetType) ?? "reset",
      count: 1,
      grantedAt: epoch(c?.grantedAt),
      expiresAt: epoch(c?.expiresAt),
    }))
    .sort((a, b) => (a.expiresAt?.getTime() ?? Infinity) - (b.expiresAt?.getTime() ?? Infinity));

  return {
    plan: str(main?.planType),
    accountId: str(result?.accountId),
    limits,
    resetCredits: credits ? { available: num(credits.availableCount) ?? items.length, items } : undefined,
  };
}

/**
 * CODEX_HOME ごとに codex app-server を起動し、アカウントと利用枠を問い合わせる。
 * 会話は送らないためトークンを消費しない。
 */
export async function collectCodex(opts: {
  home: string;
  codexBin: string;
  workDir: string;
}): Promise<Snapshot | Skipped> {
  const { home } = opts;
  const received = await exchangeJsonLines({
    command: opts.codexBin,
    args: ["app-server"],
    env: { ...process.env, CODEX_HOME: home },
    cwd: opts.workDir,
    messages: [
      {
        method: "initialize",
        id: 1,
        params: { clientInfo: { name: "ai-hp", title: "AI HP", version: "0.3.0" } },
      },
      { method: "initialized" },
      { method: "account/read", id: ACCOUNT_ID, params: { refreshToken: false } },
      { method: "account/rateLimits/read", id: RATE_LIMITS_ID },
    ],
    isDone: (r) => [ACCOUNT_ID, RATE_LIMITS_ID].every((id) => r.some((m) => obj(m)?.id === id)),
    timeoutMs: 45_000,
  });
  const reply = (id: number) => obj(received.find((m) => obj(m)?.id === id));

  const accountResult = obj(reply(ACCOUNT_ID)?.result);
  const account = obj(accountResult?.account);
  const email = str(account?.email);
  if (!account || !email) return { skipped: t("notLoggedInOrApiKey"), source: home };

  const limitsReply = reply(RATE_LIMITS_ID);
  if (limitsReply?.error) {
    throw new Error(
      t("requestFailed", { method: "account/rateLimits/read", detail: JSON.stringify(limitsReply.error).slice(0, 300) }),
    );
  }
  debugLog(`codex account/rateLimits/read (${home})`, limitsReply?.result);
  const parsed = parseCodexRateLimits(obj(limitsReply?.result));
  if (parsed.limits[0]?.kind !== "weekly") return { skipped: t("noWeeklyLimit"), source: home };

  // Team 等では chatgptAccountId を複数人で共有するため、メールと組み合わせて鍵にする
  const accountId = parsed.accountId ?? str(obj(accountResult?.workspaceRouting)?.chatgptAccountId) ?? "unknown";

  return {
    provider: "codex",
    accountKey: `codex:${accountId}:${email.toLowerCase()}`,
    email,
    plan: str(account.planType) ?? parsed.plan,
    limits: parsed.limits,
    resetCredits: parsed.resetCredits,
    fetchedAt: new Date(),
    sources: [home],
  };
}
