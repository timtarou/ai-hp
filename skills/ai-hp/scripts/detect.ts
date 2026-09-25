import { accessSync, constants, existsSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

function fromEnv(name: string): string[] | undefined {
  const v = process.env[name];
  return v ? v.split(path.delimiter).filter(Boolean) : undefined;
}

/**
 * ホーム直下の Claude / Codex の設定フォルダを見つける。
 * - Claude: ~/.claude と、CLAUDE_CONFIG_DIR 用の ~/.claude-*（.claude.json があるもの）
 * - Codex : ~/.codex と、CODEX_HOME 用の ~/.codex-*（codex が一度でも使ったもの）
 * 環境変数 AI_HP_CLAUDE_DIRS / AI_HP_CODEX_HOMES（PATH と同じ区切り）で上書きできる。
 */
export async function detectSources(home = homedir()): Promise<{ claudeDirs: string[]; codexHomes: string[] }> {
  const names = (await readdir(home, { withFileTypes: true }))
    .filter((e) => e.isDirectory() || e.isSymbolicLink())
    .map((e) => e.name)
    .sort();
  const has = (dir: string, file: string) => existsSync(path.join(home, dir, file));

  const claudeDirs =
    fromEnv("AI_HP_CLAUDE_DIRS") ??
    names
      .filter((n) => n === ".claude" || (/^\.claude-[\w-]+$/.test(n) && has(n, ".claude.json")))
      .map((n) => path.join(home, n));
  const codexHomes =
    fromEnv("AI_HP_CODEX_HOMES") ??
    names
      .filter((n) => n === ".codex" || /^\.codex-[\w-]+$/.test(n))
      // ログイン情報をキーチェーンに保存する設定だと auth.json が無いため、codex が初回起動時に作る installation_id でも判定する
      .filter((n) => has(n, "config.toml") || has(n, "auth.json") || has(n, "installation_id"))
      .map((n) => path.join(home, n));
  return { claudeDirs, codexHomes };
}

/** PATH と、よくあるインストール先から実行ファイルを探す（Windows は PATHEXT の拡張子も試す） */
export function findExecutable(name: string): string | undefined {
  const dirs = [
    ...(process.env.PATH ?? "").split(path.delimiter).filter(Boolean),
    path.join(homedir(), ".local", "bin"),
    ...(process.platform === "win32" ? [] : ["/opt/homebrew/bin", "/usr/local/bin"]),
  ];
  const exts = process.platform === "win32" ? ["", ...(process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";")] : [""];
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, name + ext);
      try {
        accessSync(candidate, constants.X_OK);
        if (statSync(candidate).isFile()) return candidate;
      } catch {
        // 次の候補へ
      }
    }
  }
  return undefined;
}
