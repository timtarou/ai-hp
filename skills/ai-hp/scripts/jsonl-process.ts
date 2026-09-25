import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { t } from "./i18n.ts";

/**
 * 1 行 1 JSON でやり取りする子プロセス（claude の stream-json / codex app-server）に
 * メッセージを送り、isDone が true になるまで応答を集めてから子プロセスを止める。
 */
export function exchangeJsonLines(opts: {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
  cwd: string;
  messages: unknown[];
  isDone: (received: unknown[]) => boolean;
  timeoutMs: number;
}): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(opts.command, opts.args, {
      env: opts.env,
      cwd: opts.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      // Windows では npm 経由の claude / codex が .cmd のため shell 経由で起動する
      shell: process.platform === "win32",
    });
    const received: unknown[] = [];
    let stderr = "";
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      if (error) reject(error);
      else resolve(received);
    };

    const timer = setTimeout(
      () => finish(new Error(`${t("timeout", { cmd: opts.command, s: opts.timeoutMs / 1000 })}${tail(stderr)}`)),
      opts.timeoutMs,
    );

    child.on("error", (e) => finish(e));
    child.on("close", (code) => finish(new Error(`${t("exited", { cmd: opts.command, code: String(code) })}${tail(stderr)}`)));
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-4000);
    });
    createInterface({ input: child.stdout }).on("line", (line) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        return; // JSON 以外の行（起動ログ等）は読み飛ばす
      }
      received.push(parsed);
      if (opts.isDone(received)) finish();
    });
    child.stdin.on("error", () => {}); // 子プロセス終了後の EPIPE は close 側で扱う
    for (const m of opts.messages) child.stdin.write(`${JSON.stringify(m)}\n`);
  });
}

function tail(s: string): string {
  const trimmed = s.trim();
  return trimmed ? `: ${trimmed.slice(-500)}` : "";
}
