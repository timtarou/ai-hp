export type Lang = "en" | "ja";

const messages = {
  // 取得をやめた理由
  notLoggedIn: { en: "not logged in", ja: "未ログイン" },
  notLoggedInOrApiKey: { en: "not logged in, or using an API key", ja: "未ログイン、または API キー利用" },
  noPlanLimits: { en: "no plan limits (API key or similar)", ja: "プラン枠の対象外（API キー利用など）" },
  noWeeklyLimit: { en: "no weekly limit info", ja: "週間枠の情報がない" },
  // エラー
  timeout: { en: "{cmd} did not respond within {s}s", ja: "{cmd} が {s} 秒以内に応答しませんでした" },
  exited: { en: "{cmd} exited unexpectedly (code {code})", ja: "{cmd} が途中で終了しました (code {code})" },
  accountSwitched: {
    en: "the account changed while fetching; this result was discarded",
    ja: "取得中にアカウントが切り替わったため、この回の値は捨てました",
  },
  requestFailed: { en: "{method} failed: {detail}", ja: "{method} が失敗しました: {detail}" },
  commandNotFound: { en: "`{cmd}` command not found", ja: "{cmd} コマンドが見つかりません" },
  cacheSaveFailed: { en: "saving last values — {detail}", ja: "前回値の保存 — {detail}" },
  // 表
  title: { en: "AI HP ({time} · {host} · soonest weekly reset first)", ja: "AI HP（{time} 時点・{host}・週間リセットの近い順）" },
  hReset: { en: "Weekly reset", ja: "週間 リセット" },
  hService: { en: "Service", ja: "サービス" },
  hAccount: { en: "Account", ja: "アカウント" },
  hWeekly: { en: "Weekly left", ja: "週間 残り" },
  hScoped: { en: "Other weekly", ja: "別枠（週間）" },
  hShort: { en: "Short-term", ja: "短期枠" },
  hBanked: { en: "Banked resets", ja: "Banked reset" },
  hoursWindow: { en: "{h}h", ja: "{h}時間" },
  notStarted: { en: "not started", ja: "未開始" },
  resetDone: { en: "passed ({time})", ja: "済（{time}）" },
  resetDoneShort: { en: "passed", ja: "済" },
  resetAt: { en: "resets {time}", ja: "{time} リセット" },
  resetPassedShort: { en: "reset", ja: "リセット済" },
  likelyReset: { en: "likely reset", ja: "リセット済みの見込み" },
  staleAt: { en: "as of {time}", ja: "{time} 時点" },
  noAccounts: { en: "no accounts found", ja: "取得できたアカウントがありません" },
  bankedNotFetched: { en: "not fetched", ja: "未取得" },
  bankedUnknown: { en: "unknown", ja: "不明" },
  bankedCount: { en: "{n}", ja: "{n}回" },
  bankedTimes: { en: "×{n}", ja: "{n}回" },
  expires: { en: "expires {time}", ja: "{time} 失効" },
  noExpiry: { en: "no expiry", ja: "失効日時不明" },
  startsFrom: { en: "from {time}", ja: "{time} から" },
  paused: { en: "paused", ja: "一時停止中" },
  noteStale: {
    en: "Rows marked 〔as of …〕 show the last values for accounts that could not be fetched this time. Log other Claude accounts into a query-only folder to keep them current (scripts/add-claude-account.sh).",
    ja: "〔○時点〕の行は今回取得できなかったアカウントの前回値です。Claude の別アカウントは、問い合わせ専用フォルダに一度ログインしておくと毎回最新値になります（scripts/add-claude-account.sh）。",
  },
  noteNotFetched: {
    en: "Banked resets marked “not fetched” could not be read this time (see “Failed” below).",
    ja: "Banked reset の「未取得」は、今回その情報を取れなかったアカウントです（理由は「取得に失敗」）。",
  },
  noteBankedOff: {
    en: "Claude’s banked resets are not shown: Claude Code does not expose them through its interfaces.",
    ja: "Claude の Banked reset は、Claude Code の窓口から取得できないため表示しません。",
  },
  noteExcluded: { en: "Not shown: {list}", ja: "表示していないフォルダ: {list}" },
  noteFailed: { en: "Failed: {detail}", ja: "取得に失敗: {detail}" },
  // 残り時間
  inDaysHours: { en: "in {d}d {h}h", ja: "あと{d}日{h}時間" },
  inHoursMinutes: { en: "in {h}h {m}m", ja: "あと{h}時間{m}分" },
  inMinutes: { en: "in {m}m", ja: "あと{m}分" },
} satisfies Record<string, Record<Lang, string>>;

export type MessageKey = keyof typeof messages;

let current: Lang = "en";

export function setLang(lang: Lang): void {
  current = lang;
}

export function getLang(): Lang {
  return current;
}

export function isLang(v: unknown): v is Lang {
  return v === "en" || v === "ja";
}

/** OS の言語設定から推測する（ja で始まれば日本語、それ以外は英語） */
export function langFromLocale(env: NodeJS.ProcessEnv = process.env): Lang {
  const locale = env.LC_ALL || env.LC_MESSAGES || env.LANG || Intl.DateTimeFormat().resolvedOptions().locale;
  return /^ja/i.test(locale ?? "") ? "ja" : "en";
}

export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  return messages[key][current].replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

export function hasMessage(key: string): key is MessageKey {
  return Object.hasOwn(messages, key);
}
