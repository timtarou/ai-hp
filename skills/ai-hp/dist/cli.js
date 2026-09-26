#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCache, pickCachedOnly, saveCache } from "./cache.js";
import { collectClaude } from "./collect/claude.js";
import { oneLiner } from "./commentary.js";
import { collectCodex } from "./collect/codex.js";
import { detectSources, findExecutable } from "./detect.js";
import { getLang, setLang, t } from "./i18n.js";
import { buildReport, renderMarkdown } from "./report.js";
import { configDir, loadSettings, setDebug } from "./settings.js";
import { renderTerminal } from "./terminal.js";
/** package.json と .claude-plugin/plugin.json の version と揃える（test/build.test.ts が検査する） */
const VERSION = "0.5.0";
const HELP = `ai-hp ${VERSION} — an HP bar for your AI accounts: weekly usage limits, reset times and banked resets for all your Claude Code and Codex accounts

Usage:
  ai-hp [--lang en|ja] [--markdown] [--no-color] [--comment] [--debug]
  ai-hp add-claude <name> [email]   log another Claude account into ~/.claude-<name> (query-only)
  ai-hp add-codex <name>            log another Codex account into ~/.codex-<name>

  --lang en|ja   output language (default: AI_HP_LANG, config.json, or your OS locale)
  --markdown     print a Markdown table (the default when the output is not a terminal)
  --no-color     no colors in the terminal table (also NO_COLOR=1)
  --comment      add a one-line tip after the table (off by default; --no-comment turns it off again)
  --debug        print the raw server responses to stderr (no tokens) for bug reports
  --version      print the version

Settings file: ${path.join(configDir(), "config.json")}
  { "lang": "en", "timeZone": "Asia/Tokyo", "commentary": true }
Environment: AI_HP_LANG, AI_HP_TZ, AI_HP_COMMENTARY, AI_HP_CLAUDE_DIRS, AI_HP_CODEX_HOMES, AI_HP_DEBUG, NO_COLOR, FORCE_COLOR`;
/** アカウント追加のサブコマンド。スキルに同梱のシェルスクリプトを実行する */
const ACCOUNT_SCRIPTS = {
    "add-claude": "add-claude-account.sh",
    "add-codex": "add-codex-account.sh",
};
function runAccountScript(command, args) {
    // dist/cli.js からも scripts/cli.ts からも、スキルの scripts フォルダを指す
    const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", ACCOUNT_SCRIPTS[command]);
    const env = { ...process.env, AI_HP_SELF: `ai-hp ${command}` }; // スクリプトの案内に出すコマンド名
    const r = spawnSync("sh", [file, ...args], { stdio: "inherit", env });
    if (r.error) {
        console.error(`${r.error.message}\nAdding accounts needs a POSIX shell (macOS, Linux or WSL).`);
        return 1;
    }
    return r.status ?? 1;
}
/** NO_COLOR（https://no-color.org）と FORCE_COLOR に従う。どちらも無ければターミナルのときだけ色を付ける */
function useColor(argv, env) {
    if (argv.includes("--no-color") || (env.NO_COLOR ?? "") !== "")
        return false;
    if (env.FORCE_COLOR !== undefined)
        return env.FORCE_COLOR !== "0";
    return !!process.stdout.isTTY;
}
function describe(e) {
    return e instanceof Error ? e.message : String(e);
}
/** 同じアカウントに複数のフォルダでログインしている場合は 1 件にまとめ、取得元を並べる */
function mergeByAccount(snapshots) {
    const byKey = new Map();
    for (const s of snapshots) {
        const prev = byKey.get(s.accountKey);
        if (!prev)
            byKey.set(s.accountKey, s);
        else {
            // Banked reset を取れた方を優先し、どちらも同じなら新しい方を使う
            const preferS = !!s.resetCredits !== !!prev.resetCredits ? !!s.resetCredits : prev.fetchedAt < s.fetchedAt;
            const base = preferS ? s : prev;
            byKey.set(s.accountKey, { ...base, sources: [...prev.sources, ...s.sources] });
        }
    }
    return [...byKey.values()];
}
async function main(argv) {
    if (argv.includes("--help") || argv.includes("-h")) {
        console.log(HELP);
        return 0;
    }
    if (argv.includes("--version") || argv.includes("-v")) {
        console.log(VERSION);
        return 0;
    }
    if (argv[0] && Object.hasOwn(ACCOUNT_SCRIPTS, argv[0]))
        return runAccountScript(argv[0], argv.slice(1));
    const settings = await loadSettings(argv);
    setLang(settings.lang);
    setDebug(settings.debug);
    const { claudeDirs, codexHomes } = await detectSources();
    const claudeBin = findExecutable("claude");
    const codexBin = findExecutable("codex");
    const workDir = path.join(tmpdir(), "ai-hp");
    await mkdir(workDir, { recursive: true });
    const problems = [];
    const tasks = [];
    if (claudeBin) {
        for (const configDir of claudeDirs) {
            tasks.push({ source: configDir, run: () => collectClaude({ configDir, claudeBin, workDir }) });
        }
    }
    else if (claudeDirs.length > 0) {
        problems.push(t("commandNotFound", { cmd: "claude" }));
    }
    if (codexBin) {
        for (const home of codexHomes) {
            tasks.push({ source: home, run: () => collectCodex({ home, codexBin, workDir }) });
        }
    }
    else if (codexHomes.length > 0) {
        problems.push(t("commandNotFound", { cmd: "codex" }));
    }
    // 各アカウントを並行して問い合わせる
    const results = await Promise.allSettled(tasks.map((task) => task.run()));
    const collected = [];
    const excluded = [];
    results.forEach((r, i) => {
        const source = path.basename(tasks[i].source);
        if (r.status === "rejected")
            problems.push(`${source} — ${describe(r.reason)}`);
        else if ("skipped" in r.value) {
            excluded.push(getLang() === "ja" ? `${source}（${r.value.skipped}）` : `${source} (${r.value.skipped})`);
        }
        else
            collected.push(r.value);
    });
    const fresh = mergeByAccount(collected);
    for (const s of fresh) {
        if (s.warning)
            problems.push(`${s.sources.map((p) => path.basename(p)).join(" / ")} — ${s.warning}`);
    }
    const now = new Date();
    let cached = [];
    try {
        cached = pickCachedOnly(await loadCache(), fresh, now);
        await saveCache([...fresh, ...cached]);
    }
    catch (e) {
        problems.push(t("cacheSaveFailed", { detail: describe(e) }));
    }
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
    console.log(markdown
        ? renderMarkdown(model)
        : renderTerminal(model, { columns: process.stdout.columns || 120, color: useColor(argv, process.env) }));
    return fresh.length === 0 && problems.length > 0 ? 1 : 0;
}
main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
}, (e) => {
    console.error(describe(e));
    process.exitCode = 1;
});
