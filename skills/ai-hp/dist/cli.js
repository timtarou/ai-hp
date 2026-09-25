import { mkdir } from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import path from "node:path";
import { loadCache, pickCachedOnly, saveCache } from "./cache.js";
import { collectClaude } from "./collect/claude.js";
import { oneLiner } from "./commentary.js";
import { collectCodex } from "./collect/codex.js";
import { detectSources, findExecutable } from "./detect.js";
import { getLang, setLang, t } from "./i18n.js";
import { renderReport } from "./report.js";
import { configDir, loadSettings, setDebug } from "./settings.js";
const HELP = `ai-hp — weekly usage limits, reset times and banked resets for all your Claude Code and Codex accounts

Usage: node dist/cli.js [--lang en|ja] [--no-comment] [--debug]

  --lang en|ja   output language (default: AI_HP_LANG, config.json, or your OS locale)
  --no-comment   leave out the one-liner after the table
  --debug        print the raw server responses to stderr (no tokens) for bug reports

Settings file: ${path.join(configDir(), "config.json")}
  { "lang": "en", "timeZone": "Asia/Tokyo", "commentary": true }
Environment: AI_HP_LANG, AI_HP_TZ, AI_HP_COMMENTARY, AI_HP_CLAUDE_DIRS, AI_HP_CODEX_HOMES, AI_HP_DEBUG`;
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
    console.log(renderReport({
        fresh,
        cached,
        excluded,
        problems,
        now,
        host: hostname().replace(/\.local$/, ""),
        timeZone: settings.timeZone,
        comment: settings.commentary ? oneLiner(fresh, now) : undefined,
    }));
    return fresh.length === 0 && problems.length > 0 ? 1 : 0;
}
main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
}, (e) => {
    console.error(describe(e));
    process.exitCode = 1;
});
