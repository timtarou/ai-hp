import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { findExecutable } from "./detect.js";
import { getLang } from "./i18n.js";
const message = (ja, en) => getLang() === "ja" ? ja : en;
/** mkdir を排他的に使い、既存のログイン先を上書きしない。失敗したフォルダも再利用しない。 */
export async function connectAccount(provider, run, options = {}) {
    const log = options.log ?? console.log;
    if (!(options.executable ?? findExecutable)(provider)) {
        log(message(`${provider} CLIが見つかりません。インストール後にもう一度接続してください。`, `${provider} CLI was not found. Install it, then connect again.`));
        return 1;
    }
    const home = options.home ?? homedir();
    let name;
    for (let index = 1;; index++) {
        name = `ai-hp-${index}`;
        try {
            await mkdir(path.join(home, `.${provider}-${name}`), { mode: 0o700 });
            break;
        }
        catch (error) {
            if (error.code !== "EEXIST")
                throw error;
        }
    }
    log(message(`${provider}に接続します。ブラウザで追加したいアカウントを選んでください。名前や保存先の入力は不要です。`, `Connect to ${provider}: choose the account in your browser. No name or folder setup is needed.`));
    const code = run(`add-${provider}`, [name]);
    if (code === 0)
        log(message("接続が完了しました。次回のai-hp実行で自動的に表示されます。", "Connected. The account will appear on the next ai-hp refresh."));
    else
        log(message("接続は完了していません。同じconnectコマンドで再試行できます。", "Connection did not complete. Run the same connect command to try again."));
    return code;
}
export async function connect(argv, run) {
    // --lang is already handled by loadSettings; reject other arguments before starting login.
    const args = [];
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--lang") {
            i++;
            continue;
        }
        if (argv[i].startsWith("--lang="))
            continue;
        args.push(argv[i]);
    }
    if (args.length > 1 || (args.length === 1 && args[0] !== "claude" && args[0] !== "codex")) {
        console.error("Usage: ai-hp connect [claude|codex] [--lang en|ja]");
        return 2;
    }
    let provider = args[0];
    if (!provider) {
        if (!process.stdin.isTTY || !process.stdout.isTTY) {
            console.error(message("接続先を指定してください: ai-hp connect claude / ai-hp connect codex", "Choose a provider: ai-hp connect claude / ai-hp connect codex"));
            return 2;
        }
        const terminal = createInterface({ input: process.stdin, output: process.stdout });
        try {
            const answer = (await terminal.question(message("接続するサービス: 1) Claude  2) Codex  Enter) キャンセル\n> ", "Connect an account: 1) Claude  2) Codex  Enter) Cancel\n> "))).trim().toLowerCase();
            if (!answer || answer === "q")
                return 0;
            provider = answer === "1" ? "claude" : answer === "2" ? "codex" : answer;
        }
        finally {
            terminal.close();
        }
        if (provider !== "claude" && provider !== "codex") {
            console.error(message("1または2を選んで、もう一度実行してください。", "Run again and choose 1 or 2."));
            return 2;
        }
    }
    return connectAccount(provider, run);
}
