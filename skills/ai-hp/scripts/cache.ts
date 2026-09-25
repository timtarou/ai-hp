import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { arr, num, obj, str } from "./json.ts";
import { cacheDir } from "./settings.ts";
import type { Limit, ResetCredit, Snapshot } from "./types.ts";

/**
 * 前回取得した値。Claude を /login で切り替えている場合、今ログインしていないアカウントは
 * 取得できないので、ここに残した値を「○時点」として表示する。
 * v3: Limit を kind（weekly / scoped / short）で持つ形にした。以前の形式とは混ぜない
 */
function cachePath(): string {
  return process.env.AI_HP_CACHE ?? path.join(cacheDir(), "snapshots-v3.json");
}

/** これより古い値は表示せず捨てる（週間枠 2 周期分） */
export const KEEP_MS = 14 * 24 * 60 * 60_000;

function date(v: unknown): Date | undefined {
  const s = str(v);
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function reviveLimit(v: unknown): Limit | undefined {
  const l = obj(v);
  const kind = l?.kind === "weekly" || l?.kind === "scoped" || l?.kind === "short" ? l.kind : undefined;
  const usedPercent = num(l?.usedPercent);
  if (!kind || usedPercent === undefined) return undefined;
  return { kind, scope: str(l?.scope), windowHours: num(l?.windowHours), usedPercent, resetsAt: date(l?.resetsAt) };
}

export function reviveSnapshot(v: unknown): Snapshot | undefined {
  const o = obj(v);
  const provider = o?.provider === "claude" || o?.provider === "codex" ? o.provider : undefined;
  const accountKey = str(o?.accountKey);
  const email = str(o?.email);
  const fetchedAt = date(o?.fetchedAt);
  if (!o || !provider || !accountKey || !email || !fetchedAt) return undefined;

  const credits = obj(o.resetCredits);
  const items: ResetCredit[] = arr(credits?.items)
    .map(obj)
    .filter((c) => c !== undefined)
    .map((c) => ({
      title: str(c.title) ?? "reset",
      count: num(c.count) ?? 1,
      grantedAt: date(c.grantedAt),
      startsAt: date(c.startsAt),
      expiresAt: date(c.expiresAt),
      paused: c.paused === true,
    }));

  return {
    provider,
    accountKey,
    email,
    plan: str(o.plan),
    limits: arr(o.limits)
      .map(reviveLimit)
      .filter((l) => l !== undefined),
    resetCredits: credits
      ? { available: num(credits.available) ?? items.length, items, note: str(credits.note) }
      : undefined,
    resetCreditsOff: o.resetCreditsOff === true,
    fetchedAt,
    sources: arr(o.sources).filter((s): s is string => typeof s === "string"),
  };
}

export async function loadCache(): Promise<Snapshot[]> {
  let raw: string;
  try {
    raw = await readFile(cachePath(), "utf8");
  } catch {
    return [];
  }
  try {
    return arr(JSON.parse(raw))
      .map(reviveSnapshot)
      .filter((s) => s !== undefined);
  } catch {
    return []; // 壊れていたら前回値なしとして扱う
  }
}

export async function saveCache(snapshots: Snapshot[]): Promise<void> {
  const file = cachePath();
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  // warning はその回だけの情報なので残さない
  await writeFile(tmp, `${JSON.stringify(snapshots.map(({ warning: _, ...s }) => s), null, 2)}\n`);
  await rename(tmp, file); // 同時実行しても壊れたファイルを残さない
}

/** 今回取れなかったアカウントのうち、前回値が新しいものを返す */
export function pickCachedOnly(cache: Snapshot[], fresh: Snapshot[], now: Date): Snapshot[] {
  const freshKeys = new Set(fresh.map((s) => s.accountKey));
  return cache.filter((s) => !freshKeys.has(s.accountKey) && now.getTime() - s.fetchedAt.getTime() < KEEP_MS);
}
