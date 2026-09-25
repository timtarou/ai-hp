import { getLang, type Lang } from "./i18n.ts";
import { remainingPercent } from "./report.ts";
import { formatRemaining } from "./time.ts";
import type { Limit, Snapshot } from "./types.ts";

/**
 * 表のあとに出す「ひとこと」（1 行だけ）。数字から、いま一番役に立つ状況を 1 つ選び、
 * ゲームやアニメのネタを混ぜた言い回しにする。引用は短い決め台詞にとどめる。
 * 毎回同じにならないよう、言い回しは候補から選ぶ。スキルとして呼ばれたときは、AI がこの 1 行を
 * その時のミームで書き直す（SKILL.md）。
 */
type Pool = Record<Lang, string[]>;

const POOLS = {
  // リセットまで 24 時間以内なのに枠がたっぷり残っている
  useItOrLoseIt: {
    ja: [
      "{who} は残り{r}%なのにリセットまで{left}。宝箱を開けずにダンジョンを出る気か？ 急いでぶん回せ！",
      "{who}、残り{r}%でリセットまで{left}。いつやるか？ 今でしょ！ ぶん回せ！",
      "エリクサー症候群を発症中：{who} の残り{r}%は、{left}で消えます。使い切れ！",
      "{who} は MP を{r}%も残したまま、{left}で宿屋行き。泊まる前に呪文を撃ちまくれ！",
    ],
    en: [
      "{who} still has {r}% and resets {left}. Don't leave the dungeon with unopened chests — go full send!",
      "Elixir syndrome detected: {who}'s {r}% vanishes {left}. Burn it!",
      "{who}: {r}% left, resets {left}. Use it or lose it!",
      "{who} is heading to the inn {left} with {r}% MP unspent. Cast everything first!",
    ],
  },
  // 全アカウントが残り 0%
  allEmpty: {
    ja: [
      "全員 HP 0。へんじがない、ただのしかばねのようだ……。最初に復活するのは {who}（リセットまで{left}）。",
      "パーティー全滅。教会で待とう。最初に生き返るのは {who}、リセットまで{left}。",
      "全アカウント枠切れ。今日は寝て、{who} のリセット（{left}）を待つのが最適解。",
    ],
    en: [
      "Party wiped — everyone's at 0 HP. First to revive: {who}, resets {left}.",
      "All accounts are out. Touch grass until {who} resets {left}.",
      "Game over for now. Continue? {who} respawns {left}.",
    ],
  },
  // どのアカウントもほぼ枠がなく、回復も遠く、Banked reset もない: 追加購入をすすめる
  buyMore: {
    ja: [
      "どのアカウントもほぼ枠なし、次の回復まで{left}。時間を買うなら追加クレジットかプランの格上げを。ただし課金は家賃まで。",
      "全員ガス欠で、最短の回復も{left}。ここは石を割る場面かも（課金は計画的に）。",
      "残り枠はほぼゼロ、回復まで{left}。締め切りが迫っているなら、課金で時間を買え。",
    ],
    en: [
      "Every account is nearly empty and the next reset is {left}. If time matters, buy extra usage or upgrade — just don't spend the rent.",
      "Running on fumes everywhere; the next refill is {left}. Deadline? Time to open the wallet.",
      "Almost no quota left anywhere, next reset {left}. Pay to win — responsibly.",
    ],
  },
  // 残り 0% だが Banked reset を持っている
  bankedAtZero: {
    ja: [
      "{who} は HP 0 だけど Banked reset を{n}個持ってる。ザオリクを唱えるなら今！",
      "{who} は瀕死……でもフェニックスの尾が{n}本ある。ためらわず使え。",
    ],
    en: [
      "{who} is at 0 HP but holds {n} banked reset(s). Phoenix Down, now!",
      "{who} is down, yet has {n} banked reset(s) in the bag. Revive and carry on.",
    ],
  },
  // 残り 0% で Banked reset を持っているが、自然なリセットまで 2 日以内: 温存
  keepBanked: {
    ja: [
      "{who} は{left}で宿屋（リセット）に着く。ザオリクは次の全滅まで温存で。",
      "{who} はリセットまで{left}。Banked reset は使わずに、ひと晩寝て回復しよう。",
    ],
    en: [
      "{who} reaches the inn {left} — save the Phoenix Down for the next wipe.",
      "{who} resets {left}. Sleep it off and keep the banked reset for later.",
    ],
  },
  // Banked reset の失効が近い
  bankedExpiring: {
    ja: [
      "{who} の Banked reset は{left}で失効。取っておいて腐らせるのは、エリクサー症候群の末期症状です。",
      "{who} の Banked reset、使用期限まで{left}。ラストエリクサーは使ってこそ。",
    ],
    en: [
      "{who}'s banked reset expires {left}. Hoarding it until it rots is terminal elixir syndrome.",
      "{who}'s banked reset expires {left}. The Last Elixir is meant to be used.",
    ],
  },
  // 全体の枠は減っているのに別枠（Fable 等）は残っている
  separateStomach: {
    ja: [
      "{who} は本体が残り{r}%でも、{scope} 枠はまだ{f}%。デザートは別腹です。",
      "{who} の本体は残り{r}%。でも {scope} 枠が{f}%残ってる。控えの選手を出せ！",
    ],
    en: [
      "{who}'s main pool is at {r}%, but {scope} still has {f}%. There's always room for dessert.",
      "{who} is at {r}%, but the {scope} bench has {f}% left. Sub them in!",
    ],
  },
  // 元気なアカウントがなく、残りが少ない
  lowHp: {
    ja: [
      "{who} は HP {r}%、リセットまで{left}。作戦は『いのちだいじに』で。",
      "{who} は残り{r}%（リセットまで{left}）。逃げちゃダメだ……でも温存はアリ。",
      "{who} は赤ゲージ（残り{r}%）。リセットまで{left}、パーティー交代を検討しよう。",
    ],
    en: [
      "{who} is at {r}% HP and resets {left}. Tactics: don't use MP.",
      "{who} is in the red ({r}%) and resets {left}. Swap in another party member.",
    ],
  },
  // いちばん余裕のあるアカウント
  bestPick: {
    ja: [
      "今いちばん元気なのは {who}（残り{r}%）。君に決めた！",
      "次の出撃は {who}（残り{r}%）で。",
      "エースは {who}、残り{r}%。ここからが本番だ。",
    ],
    en: [
      "{who} ({r}% left) — I choose you!",
      "Next sortie: {who}, {r}% left.",
      "Your freshest fighter: {who} at {r}%.",
    ],
  },
} satisfies Record<string, Pool>;

type Situation = keyof typeof POOLS;

/** 候補の中から 1 つ選ぶ。テストでは固定の選び方を渡す */
export type Picker = (count: number) => number;

const randomPicker: Picker = (count) => Math.floor(Math.random() * count);

const PROVIDER_NAME = { claude: "Claude", codex: "Codex" } as const;

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

/** 「Claude claude2」のような短い呼び名。同じ呼び名が複数あれば（個人と Team など）「Claude tim/team」のようにプランを添える */
function labeler(snapshots: Snapshot[]): (s: Snapshot) => string {
  const base = (s: Snapshot) => `${PROVIDER_NAME[s.provider]} ${s.email.split("@")[0]}`;
  const counts = new Map<string, number>();
  for (const s of snapshots) counts.set(base(s), (counts.get(base(s)) ?? 0) + 1);
  return (s) => {
    const b = base(s);
    if ((counts.get(b) ?? 0) < 2 || !s.plan) return b;
    return `${b}/${s.plan}`;
  };
}

type Account = { s: Snapshot; weekly: Limit; r: number; hoursLeft?: number };

function usableCredits(s: Snapshot, now: Date): { count: number; soonest?: Date } {
  const items = (s.resetCredits?.items ?? []).filter((i) => !i.expiresAt || i.expiresAt > now);
  const count = items.length > 0 ? items.reduce((sum, i) => sum + i.count, 0) : (s.resetCredits?.available ?? 0);
  const soonest = items
    .map((i) => i.expiresAt)
    .filter((d): d is Date => d !== undefined)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  return { count, soonest };
}

/**
 * 今回取得できたアカウントから、いま一番役に立つ「ひとこと」を 1 行だけ選ぶ（前回値は使わない）。
 * 優先順: 全体の枠切れ（課金 / 回復待ち）→ 消える枠をぶん回せ → Banked reset を使え / 温存 →
 * Banked reset の失効間近 → 別枠は別腹 → 元気なアカウントを使え → 赤ゲージは温存。
 * アカウントがあれば必ず 1 行返す。
 */
export function oneLiner(fresh: Snapshot[], now: Date, pick: Picker = randomPicker): string | undefined {
  const lang = getLang();
  const label = labeler(fresh);
  const accounts: Account[] = [];
  for (const s of fresh) {
    const weekly = s.limits.find((l) => l.kind === "weekly");
    if (!weekly) continue;
    const hoursLeft = weekly.resetsAt ? (weekly.resetsAt.getTime() - now.getTime()) / 3_600_000 : undefined;
    accounts.push({ s, weekly, r: remainingPercent(weekly.usedPercent), hoursLeft });
  }
  if (accounts.length === 0) return undefined;

  const say = (situation: Situation, params: Record<string, string | number>) => {
    const pool = POOLS[situation][lang];
    return fill(pool[pick(pool.length) % pool.length], params);
  };
  const left = (d: Date) => formatRemaining(now, d);
  const upcoming = (a: Account) => a.hoursLeft !== undefined && a.hoursLeft > 0;
  const bySoonest = (a: Account, b: Account) => (a.hoursLeft ?? Infinity) - (b.hoursLeft ?? Infinity);
  const credits = (a: Account) => usableCredits(a.s, now);
  const anyCredits = accounts.some((a) => credits(a).count > 0);
  const soonest = accounts.filter(upcoming).sort(bySoonest)[0];

  // 1. 全体の枠切れ（Banked reset もない）: 回復が 1 日より先なら課金、近いなら待つ
  //    別枠（Fable 等）が 15% 以上残っていれば、まだ作業できるので枠切れに数えない
  const nearlyEmpty = (a: Account) =>
    a.r < 15 && !a.s.limits.some((l) => l.kind === "scoped" && remainingPercent(l.usedPercent) >= 15);
  if (!anyCredits && accounts.every(nearlyEmpty) && soonest?.weekly.resetsAt) {
    if ((soonest.hoursLeft ?? 0) > 24) return say("buyMore", { left: left(soonest.weekly.resetsAt) });
    if (accounts.every((a) => a.r === 0)) {
      return say("allEmpty", { who: label(soonest.s), left: left(soonest.weekly.resetsAt) });
    }
  }

  // 2. リセットまで 24 時間以内で残り 50% 以上: 使わないと消える
  const expiringQuota = accounts.filter((a) => upcoming(a) && (a.hoursLeft ?? 0) <= 24 && a.r >= 50).sort(bySoonest)[0];
  if (expiringQuota?.weekly.resetsAt) {
    return say("useItOrLoseIt", { who: label(expiringQuota.s), r: expiringQuota.r, left: left(expiringQuota.weekly.resetsAt) });
  }

  // 3. 残り 0% で Banked reset を持っている: 自然なリセットが 2 日より先なら使え、近いなら温存
  const down = accounts.filter((a) => a.r === 0 && credits(a).count > 0);
  const revive = down.find((a) => !upcoming(a) || (a.hoursLeft ?? 0) > 48);
  if (revive) return say("bankedAtZero", { who: label(revive.s), n: credits(revive).count });
  const keep = down.filter(upcoming).sort(bySoonest)[0];
  if (keep?.weekly.resetsAt) return say("keepBanked", { who: label(keep.s), left: left(keep.weekly.resetsAt) });

  // 4. Banked reset の失効が 7 日以内
  const expiring = accounts
    .map((a) => ({ a, at: credits(a).soonest }))
    .filter((x): x is { a: Account; at: Date } => !!x.at && x.at.getTime() - now.getTime() <= 7 * 24 * 3_600_000)
    .sort((x, y) => x.at.getTime() - y.at.getTime())[0];
  if (expiring) return say("bankedExpiring", { who: label(expiring.a.s), left: left(expiring.at) });

  // 5. 全体の枠は 30% 未満なのに、別枠（Fable 等）は 80% 以上残っている
  for (const a of accounts) {
    const scoped = a.s.limits.find((l) => l.kind === "scoped" && remainingPercent(l.usedPercent) >= 80);
    if (a.r < 30 && scoped) {
      return say("separateStomach", { who: label(a.s), r: a.r, scope: scoped.scope ?? "?", f: remainingPercent(scoped.usedPercent) });
    }
  }

  // 6. 残り 50% 以上のアカウントがあれば、それを使えと言う（同じならリセットが近い方）
  const best = [...accounts].sort((a, b) => b.r - a.r || bySoonest(a, b))[0];
  if (best.r >= 50) return say("bestPick", { who: label(best.s), r: best.r });

  // 7. 元気なアカウントがなく、残り 20% 未満のアカウントがある: 温存
  const low = accounts.filter((a) => a.r > 0 && a.r < 20).sort((a, b) => a.r - b.r)[0];
  if (low?.weekly.resetsAt) return say("lowHp", { who: label(low.s), r: low.r, left: left(low.weekly.resetsAt) });

  // 8. それ以外は、いちばん余裕のあるアカウント
  if (best.r > 0) return say("bestPick", { who: label(best.s), r: best.r });
  return soonest?.weekly.resetsAt ? say("allEmpty", { who: label(soonest.s), left: left(soonest.weekly.resetsAt) }) : undefined;
}
