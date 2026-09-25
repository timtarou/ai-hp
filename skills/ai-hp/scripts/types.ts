export type Provider = "claude" | "codex";

export type Limit = {
  /** weekly: 全体の週間枠 / scoped: モデル別などの週間の別枠（Claude の Fable 等）/ short: 5 時間枠など */
  kind: "weekly" | "scoped" | "short";
  /** scoped の対象（例: "Fable"） */
  scope?: string;
  /** short の枠の長さ（時間） */
  windowHours?: number;
  usedPercent: number;
  /** 周期がまだ始まっていない枠には無い */
  resetsAt?: Date;
};

/** Banked reset（取っておいた利用枠のリセット権）。Codex は 1 件 1 回、Claude は付与単位ごとに残り回数を持つ */
export type ResetCredit = {
  title: string;
  count: number;
  grantedAt?: Date;
  /** これより前は使えない */
  startsAt?: Date;
  /** 使用期限 */
  expiresAt?: Date;
  paused?: boolean;
};

/** 1 アカウントの、ある時点の利用状況。サーバーから取得した値だけを入れる */
export type Snapshot = {
  provider: Provider;
  /** 同じアカウントを指す鍵。例: "claude:<accountUuid>:<organizationUuid>" */
  accountKey: string;
  email: string;
  plan?: string;
  /** 全体の週間枠、別枠（Fable 等）、短期枠の順 */
  limits: Limit[];
  /** undefined は取得できなかった。note は対象外の理由など */
  resetCredits?: { available: number; items: ResetCredit[]; note?: string };
  /** Banked reset を取得しない（Claude: Claude Code の窓口に含まれないため）。表では「—」 */
  resetCreditsOff?: boolean;
  /** 利用枠は取れたが一部（Banked reset 等）を取れなかった理由 */
  warning?: string;
  fetchedAt: Date;
  /** 取得元の設定フォルダ（同じアカウントに複数でログインしていればすべて） */
  sources: string[];
};

/** 取得をやめた理由（未ログインなど）。エラーではない */
export type Skipped = { skipped: string; source: string };
