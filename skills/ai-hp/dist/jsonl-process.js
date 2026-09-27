import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { t } from "./i18n.js";
const active = new Set();
function cancelActive() { for (const cancel of [...active])
    cancel(); }
function register(cancel) {
    if (active.size === 0) {
        process.on("SIGTERM", cancelActive);
        process.on("SIGINT", cancelActive);
    }
    active.add(cancel);
}
function unregister(cancel) {
    active.delete(cancel);
    if (active.size === 0) {
        process.off("SIGTERM", cancelActive);
        process.off("SIGINT", cancelActive);
    }
}
/**
 * 1 行 1 JSON でやり取りする子プロセス（claude の stream-json / codex app-server）に
 * メッセージを送り、isDone が true になるまで応答を集めてから子プロセスを止める。
 */
export function exchangeJsonLines(opts) {
    return new Promise((resolve, reject) => {
        const child = spawn(opts.command, opts.args, {
            env: opts.env,
            cwd: opts.cwd,
            stdio: ["pipe", "pipe", "pipe"],
            // Windows では npm 経由の claude / codex が .cmd のため shell 経由で起動する
            shell: process.platform === "win32",
            // A menu bar refresh can be cancelled; isolate provider descendants for cleanup.
            detached: process.platform !== "win32",
        });
        const received = [];
        let stderr = "";
        let settled = false;
        const finish = (error) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            unregister(cancel);
            const stop = (signal) => {
                try {
                    if (process.platform !== "win32" && child.pid)
                        process.kill(-child.pid, signal);
                    else
                        child.kill(signal);
                }
                catch { /* already exited */ }
            };
            stop("SIGTERM");
            // Reap descendants that ignore SIGTERM before the CLI exits.
            if (child.pid && process.platform !== "win32")
                setTimeout(() => stop("SIGKILL"), 750);
            if (error)
                reject(error);
            else
                resolve(received);
        };
        const cancel = () => finish(new Error("Usage query cancelled"));
        register(cancel);
        const timer = setTimeout(() => finish(new Error(`${t("timeout", { cmd: opts.command, s: opts.timeoutMs / 1000 })}${tail(stderr)}`)), opts.timeoutMs);
        child.on("error", (e) => finish(e));
        child.on("close", (code) => finish(new Error(`${t("exited", { cmd: opts.command, code: String(code) })}${tail(stderr)}`)));
        child.stderr.on("data", (chunk) => {
            stderr = (stderr + chunk.toString()).slice(-4000);
        });
        createInterface({ input: child.stdout }).on("line", (line) => {
            let parsed;
            try {
                parsed = JSON.parse(line);
            }
            catch {
                return; // JSON 以外の行（起動ログ等）は読み飛ばす
            }
            received.push(parsed);
            if (opts.isDone(received))
                finish();
        });
        child.stdin.on("error", () => { }); // 子プロセス終了後の EPIPE は close 側で扱う
        for (const m of opts.messages)
            child.stdin.write(`${JSON.stringify(m)}\n`);
    });
}
function tail(s) {
    const trimmed = s.trim();
    return trimmed ? `: ${trimmed.slice(-500)}` : "";
}
