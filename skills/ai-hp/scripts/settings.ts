import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { isLang, type Lang, langFromLocale } from "./i18n.ts";
import { obj, str } from "./json.ts";
import { isValidTimeZone, systemTimeZone } from "./time.ts";

export type Settings = {
  lang: Lang;
  timeZone: string;
  debug: boolean;
};

/** 設定ファイルの置き場所: $XDG_CONFIG_HOME/ai-hp（Windows は %APPDATA%\ai-hp、それ以外の既定は ~/.config/ai-hp） */
export function configDir(): string {
  if (process.env.XDG_CONFIG_HOME) return path.join(process.env.XDG_CONFIG_HOME, "ai-hp");
  if (process.platform === "win32" && process.env.APPDATA) return path.join(process.env.APPDATA, "ai-hp");
  return path.join(homedir(), ".config", "ai-hp");
}

/** 前回値の置き場所: macOS は ~/Library/Caches、Windows は %LOCALAPPDATA%、それ以外は $XDG_CACHE_HOME か ~/.cache */
export function cacheDir(): string {
  if (process.platform === "darwin") return path.join(homedir(), "Library", "Caches", "ai-hp");
  if (process.platform === "win32" && process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, "ai-hp");
  return path.join(process.env.XDG_CACHE_HOME || path.join(homedir(), ".cache"), "ai-hp");
}

function flag(v: string | undefined): boolean | undefined {
  if (v === undefined || v === "") return undefined;
  return /^(1|true|yes|on)$/i.test(v);
}

function option(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i >= 0) return argv[i + 1];
  const inline = argv.find((a) => a.startsWith(`${name}=`));
  return inline?.slice(name.length + 1);
}

/** 優先順: コマンドライン引数 > 環境変数 > 設定ファイル（config.json）> OS の設定 */
export async function loadSettings(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<Settings> {
  let file: ReturnType<typeof obj> = {};
  try {
    file = obj(JSON.parse(await readFile(path.join(configDir(), "config.json"), "utf8"))) ?? {};
  } catch {
    // 設定ファイルが無い・壊れている場合は既定値
  }
  const langArg = option(argv, "--lang");
  const lang = [langArg, env.AI_HP_LANG, file.lang].find(isLang) ?? langFromLocale(env);
  const tz = [env.AI_HP_TZ, str(file.timeZone)].find((v): v is string => !!v && isValidTimeZone(v));
  return {
    lang,
    timeZone: tz ?? systemTimeZone(),
    debug: argv.includes("--debug") || flag(env.AI_HP_DEBUG) === true,
  };
}

let debugEnabled = false;

export function setDebug(on: boolean): void {
  debugEnabled = on;
}

/** --debug のとき、サーバーからの生の応答を標準エラーに出す（不具合報告用。トークンは含めない） */
export function debugLog(label: string, value: unknown): void {
  if (debugEnabled) console.error(`[ai-hp debug] ${label}: ${JSON.stringify(value, null, 2)}`);
}
