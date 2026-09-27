#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { hostname } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectUsage, collectionExitCode, describe, failedCollection } from "./collect.ts";
import { connect } from "./connect.ts";
import { findExecutable } from "./detect.ts";
import { oneLiner } from "./commentary.ts";
import { buildJsonOutput } from "./output-json.ts";
import { getLang, setLang, t } from "./i18n.ts";
import { buildReport, renderMarkdown } from "./report.ts";
import { configDir, loadSettings, setDebug } from "./settings.ts";
import { renderTerminal } from "./terminal.ts";

/** package.json と .claude-plugin/plugin.json の version と揃える（test/build.test.ts が検査する） */
const VERSION = "0.5.0";

const HELP = `ai-hp ${VERSION} — an HP bar for your AI accounts: weekly usage limits, reset times and banked resets for all your Claude Code and Codex accounts

Usage:
  ai-hp [--lang en|ja] [--markdown] [--json] [--include-cached] [--no-color] [--comment] [--debug]
  ai-hp add-claude <name> [email]   log another Claude account into ~/.claude-<name> (query-only)
  ai-hp add-codex <name>            log another Codex account into ~/.codex-<name>
  ai-hp connect [claude|codex]      connect an account with automatic folder setup

  --lang en|ja   output language (default: AI_HP_LANG, config.json, or your OS locale)
  --markdown     print a Markdown table (the default when the output is not a terminal)
  --json         print versioned JSON for apps (takes precedence over display options)
  --include-cached  opt in to reading/writing previous observations (off by default)
  --fresh-only   disable cache even if --include-cached is also supplied (the default)
  --no-color     no colors in the terminal table (also NO_COLOR=1)
  --comment      add a one-line tip after the table (off by default; --no-comment turns it off again)
  --debug        print the raw server responses to stderr (no tokens) for bug reports
  --version      print the version

Settings file: ${path.join(configDir(), "config.json")}
  { "lang": "en", "timeZone": "Asia/Tokyo", "commentary": true }
Environment: AI_HP_LANG, AI_HP_TZ, AI_HP_COMMENTARY, AI_HP_CLAUDE_DIRS, AI_HP_CODEX_HOMES, AI_HP_DEBUG, NO_COLOR, FORCE_COLOR`;

/** アカウント追加のサブコマンド。スキルに同梱のシェルスクリプトを実行する */
const ACCOUNT_SCRIPTS: Record<string, string> = {
  "add-claude": "add-claude-account.sh",
  "add-codex": "add-codex-account.sh",
};

function runAccountScript(command: string, args: string[]): number {
  // dist/cli.js からも scripts/cli.ts からも、スキルの scripts フォルダを指す
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", ACCOUNT_SCRIPTS[command]);
  const providerBin = findExecutable(command === "add-claude" ? "claude" : "codex");
  const env = {
    ...process.env,
    PATH: [providerBin && path.dirname(providerBin), path.dirname(process.execPath), process.env.PATH].filter(Boolean).join(path.delimiter),
    AI_HP_SELF: `ai-hp ${command}`,
  };
  const r = spawnSync("sh", [file, ...args], { stdio: "inherit", env });
  if (r.error) {
    console.error(`${r.error.message}\nAdding accounts needs a POSIX shell (macOS, Linux or WSL).`);
    return 1;
  }
  return r.status ?? 1;
}

/** NO_COLOR（https://no-color.org）と FORCE_COLOR に従う。どちらも無ければターミナルのときだけ色を付ける */
function useColor(argv: string[], env: NodeJS.ProcessEnv): boolean {
  if (argv.includes("--no-color") || (env.NO_COLOR ?? "") !== "") return false;
  if (env.FORCE_COLOR !== undefined) return env.FORCE_COLOR !== "0";
  return !!process.stdout.isTTY;
}

async function main(argv: string[]): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(HELP);
    return 0;
  }
  if (argv.includes("--version") || argv.includes("-v")) {
    console.log(VERSION);
    return 0;
  }
  if (argv[0] && Object.hasOwn(ACCOUNT_SCRIPTS, argv[0])) return runAccountScript(argv[0], argv.slice(1));
  const settings = await loadSettings(argv);
  setLang(settings.lang);
  setDebug(settings.debug);

  if (argv[0] === "connect") return connect(argv.slice(1), runAccountScript);

  const result = await collectUsage({}, {
    includeCached: argv.includes("--include-cached") && !argv.includes("--fresh-only"),
  });
  if (argv.includes("--json")) {
    console.log(JSON.stringify(buildJsonOutput(result)));
    return collectionExitCode(result);
  }
  const { fresh, cached, now } = result;
  const excluded = result.excluded.map(({ source, skipped }) => getLang() === "ja"
    ? `${path.basename(source)}（${skipped}）` : `${path.basename(source)} (${skipped})`);
  const problems = result.issues.map((issue) => {
    if (issue.code === "command_not_found") return t("commandNotFound", { cmd: issue.provider ?? "" });
    if (issue.code === "cache_failed") return t("cacheSaveFailed", { detail: issue.message });
    return `${issue.sources.map((source) => path.basename(source)).join(" / ")} — ${issue.message}`;
  });

  const model = buildReport({
    fresh,
    cached,
    excluded,
    problems,
    now,
    host: hostname().replace(/\.local$/, ""),
    timeZone: settings.timeZone,
    comment: settings.commentary ? oneLiner(fresh, now) : undefined,
  });
  // スキル（Claude Code / Codex）から呼ばれたときやパイプの先は Markdown、人がターミナルで見るときは色付きの表
  const markdown = argv.includes("--markdown") || !process.stdout.isTTY;
  console.log(
    markdown
      ? renderMarkdown(model)
      : renderTerminal(model, { columns: process.stdout.columns || 120, color: useColor(argv, process.env) }),
  );
  return collectionExitCode(result);
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    if (process.argv.includes("--json")) console.log(JSON.stringify(buildJsonOutput(failedCollection(e))));
    console.error(describe(e));
    process.exitCode = 1;
  },
);
