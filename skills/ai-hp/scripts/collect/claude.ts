import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { t } from "../i18n.ts";
import { exchangeJsonLines } from "../jsonl-process.ts";
import { arr, num, obj, str, type Obj } from "../json.ts";
import { debugLog } from "../settings.ts";
import type { Limit, Skipped, Snapshot } from "../types.ts";

const USAGE_REQUEST_ID = "ai-hp-get-usage";

/** 既定の ~/.claude はアカウント情報を ~/.claude.json に置く。CLAUDE_CONFIG_DIR 指定時はそのフォルダ直下 */
function isDefaultConfigDir(configDir: string): boolean {
  return path.resolve(configDir) === path.join(homedir(), ".claude");
}

function statePath(configDir: string): string {
  return isDefaultConfigDir(configDir)
    ? path.join(homedir(), ".claude.json")
    : path.join(configDir, ".claude.json");
}

/** 同じユーザーでも個人と Team では組織（organizationUuid）が違い、利用枠も別になる */
type ClaudeAccount = { accountUuid: string; organizationUuid: string; email: string };

async function readAccount(configDir: string): Promise<ClaudeAccount | undefined> {
  let raw: string;
  try {
    raw = await readFile(statePath(configDir), "utf8");
  } catch {
    return undefined;
  }
  const account = obj(obj(JSON.parse(raw))?.oauthAccount);
  const accountUuid = str(account?.accountUuid);
  const email = str(account?.emailAddress);
  const organizationUuid = str(account?.organizationUuid) ?? "none";
  return accountUuid && email ? { accountUuid, organizationUuid, email } : undefined;
}

function sameAccount(a: ClaudeAccount | undefined, b: ClaudeAccount): boolean {
  return a?.accountUuid === b.accountUuid && a.organizationUuid === b.organizationUuid;
}

function dateOrUndefined(v: unknown): Date | undefined {
  const s = str(v);
  return s ? new Date(s) : undefined;
}

function scopeName(limit: Obj): string {
  const scope = obj(limit.scope);
  return str(obj(scope?.model)?.display_name) ?? str(scope?.surface) ?? "scoped";
}

/**
 * get_usage の応答を枠の一覧にする。rate_limits.limits には全体の週間枠（weekly_all）に加えて
 * Fable などモデル別の週間枠（weekly_scoped）が別枠として入る。
 */
export function parseClaudeUsage(usage: Obj | undefined): { plan?: string; limits: Limit[] } | { skipped: string } {
  const rateLimits = obj(usage?.rate_limits);
  if (usage?.rate_limits_available === false || !rateLimits) return { skipped: t("noPlanLimits") };
  const limits: Limit[] = [];
  const entries = arr(rateLimits.limits)
    .map(obj)
    .filter((l) => l !== undefined);

  const push = (l: Obj | undefined, limit: Omit<Limit, "usedPercent" | "resetsAt">) => {
    const used = num(l?.percent);
    if (l && used !== undefined) limits.push({ ...limit, usedPercent: used, resetsAt: dateOrUndefined(l.resets_at) });
  };
  if (entries.length > 0) {
    push(
      entries.find((l) => l.kind === "weekly_all"),
      { kind: "weekly" },
    );
    for (const l of entries.filter((e) => e.kind === "weekly_scoped")) push(l, { kind: "scoped", scope: scopeName(l) });
    push(
      entries.find((l) => l.kind === "session"),
      { kind: "short", windowHours: 5 },
    );
  } else {
    // limits が無い古い形式は seven_day / five_hour を使う
    for (const [key, limit] of [
      ["seven_day", { kind: "weekly" }],
      ["five_hour", { kind: "short", windowHours: 5 }],
    ] as const) {
      const w = obj(rateLimits[key]);
      const used = num(w?.utilization);
      if (used !== undefined) limits.push({ ...limit, usedPercent: used, resetsAt: dateOrUndefined(w?.resets_at) });
    }
  }
  if (limits[0]?.kind !== "weekly") return { skipped: t("noWeeklyLimit") };
  return { plan: str(usage?.subscription_type), limits };
}

/**
 * ログイン中の Claude アカウントの利用枠を、claude のプログラム用窓口（get_usage）で取得する。
 * 会話は送らないためトークンを消費しない。/login で切り替え中の他アカウントは取得できない。
 */
export async function collectClaude(opts: {
  configDir: string;
  claudeBin: string;
  workDir: string;
}): Promise<Snapshot | Skipped> {
  const { configDir } = opts;
  const before = await readAccount(configDir);
  if (!before) return { skipped: t("notLoggedIn"), source: configDir };

  const env: NodeJS.ProcessEnv = { ...process.env, ENABLE_CLAUDEAI_MCP_SERVERS: "false" };
  if (isDefaultConfigDir(configDir)) delete env.CLAUDE_CONFIG_DIR;
  else env.CLAUDE_CONFIG_DIR = configDir;

  const received = await exchangeJsonLines({
    command: opts.claudeBin,
    // フック・プラグイン・MCP・セッション記録を読み込まず、起動を軽くする
    args: [
      "-p",
      "--input-format", "stream-json",
      "--output-format", "stream-json",
      "--verbose",
      "--setting-sources", "project",
      "--strict-mcp-config",
      "--no-session-persistence",
    ],
    env,
    cwd: opts.workDir,
    messages: [
      { type: "control_request", request_id: "ai-hp-init", request: { subtype: "initialize" } },
      // skip_behaviors: 過去 7 日分の会話記録の走査を省く（利用枠だけ欲しいので不要）
      { type: "control_request", request_id: USAGE_REQUEST_ID, request: { subtype: "get_usage", skip_behaviors: true } },
    ],
    isDone: (r) => r.some(isUsageResponse),
    timeoutMs: 60_000,
  });

  const after = await readAccount(configDir);
  if (!sameAccount(after, before)) throw new Error(t("accountSwitched"));

  const response = obj(obj(received.find(isUsageResponse))?.response);
  if (response?.subtype === "error") {
    throw new Error(t("requestFailed", { method: "get_usage", detail: String(response.error) }));
  }
  const usage = obj(response?.response);
  debugLog(`claude get_usage (${configDir})`, usage?.rate_limits);
  const parsed = parseClaudeUsage(usage);
  if ("skipped" in parsed) return { skipped: parsed.skipped, source: configDir };

  return {
    provider: "claude",
    accountKey: `claude:${before.accountUuid}:${before.organizationUuid}`,
    email: before.email,
    plan: parsed.plan,
    limits: parsed.limits,
    // Claude の Banked reset は Claude Code の窓口（get_usage）に含まれないため表示しない
    resetCreditsOff: true,
    fetchedAt: new Date(),
    sources: [configDir],
  };
}

function isUsageResponse(m: unknown): boolean {
  const o = obj(m);
  return o?.type === "control_response" && obj(o.response)?.request_id === USAGE_REQUEST_ID;
}
