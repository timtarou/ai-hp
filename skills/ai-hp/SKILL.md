---
name: ai-hp
description: Show weekly usage limits, reset times, Claude's model-specific weekly limits (e.g. Fable), short-term limits and banked resets for every Claude Code and Codex account on this machine, soonest weekly reset first. Use when the user asks about usage limits, remaining quota, when limits reset, which account to use next, banked resets, or their "AI HP" (利用枠、残り枠、使用量、リセットはいつ、Banked reset、AI の HP).
---

# AI usage limits

Run `dist/cli.js` in this skill's directory with Node.js 18+ and show its Markdown output to the user as-is.

```bash
node <this skill's directory>/dist/cli.js --markdown --lang en   # English
node <this skill's directory>/dist/cli.js --markdown --lang ja   # 日本語
```

Pass `--lang` matching the language the user is writing in. Always pass `--markdown` (without it, a terminal gets a colored table instead).

## Running it

- It uses the network and each CLI's own login (`claude -p` for Claude Code, `codex app-server` for Codex). **In Codex, ask to run it outside the sandbox from the start** — it fails inside the sandbox.
- It takes 5–15 seconds. It sends no prompts, so it uses no tokens.
- It covers the accounts logged in on this machine: `~/.claude`, `~/.claude-*` (`CLAUDE_CONFIG_DIR`), `~/.codex` and `~/.codex-*` (`CODEX_HOME`).

## Showing the output

- Paste the output as-is. Do not summarize, reorder, translate or drop columns (other weekly limits such as Fable, short-term limits, banked resets).
- Under the table there is a single 💬 line of advice. **Replace it with your own single 💬 line** in the user's language: keep its advice, but make it fresh and fun — a timely meme, a short anime catchphrase or a game reference (HP, MP, inns, revive items). Exactly one 💬 line in the end; do not add any other comment. Keep quotes to a few words and never mock anyone. If you cannot improve it, keep the original line.
- If there are "Failed" lines, relay them verbatim. Never fill in values by guessing.
- If the user asks for no jokes, run with `--no-comment`; there is then no 💬 line to write.

## Adding accounts

If the user wants more accounts in the list, give them these commands. The browser login is theirs to complete.

```bash
# Claude: a query-only folder ~/.claude-<name>. It does not touch the login in ~/.claude.
sh <this skill's directory>/scripts/add-claude-account.sh <name> <email>
# Codex: logs in to ~/.codex-<name> (pass an existing folder's suffix to reuse it, e.g. account-b)
sh <this skill's directory>/scripts/add-codex-account.sh <name>
```

Personal and Team plans under the same email are separate accounts with separate limits, so give them separate names (for example `alex` and `alex-personal`). The "Not shown" line under the table lists folders that are not logged in.
