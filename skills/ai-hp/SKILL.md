---
name: ai-hp
description: Show weekly usage limits, reset times, Claude's model-specific weekly limits (e.g. Fable), short-term limits and banked resets for every Claude Code and Codex account on this machine, soonest weekly reset first. Use when the user asks about usage limits, remaining quota, when limits reset, which account to use next, or banked resets (利用枠、残り枠、使用量、リセットはいつ、Banked reset).
---

# AI usage limits

Run `scripts/cli.ts` in this skill's directory with Node.js 22.18+ and show its Markdown output to the user as-is.

```bash
node <this skill's directory>/scripts/cli.ts --lang en   # English
node <this skill's directory>/scripts/cli.ts --lang ja   # 日本語
```

Pass `--lang` matching the language the user is writing in.

## Running it

- It uses the network and each CLI's own login (`claude -p` for Claude Code, `codex app-server` for Codex). **In Codex, ask to run it outside the sandbox from the start** — it fails inside the sandbox.
- It takes 5–15 seconds. It sends no prompts, so it uses no tokens.
- It covers the accounts logged in on this machine: `~/.claude`, `~/.claude-*` (`CLAUDE_CONFIG_DIR`), `~/.codex` and `~/.codex-*` (`CODEX_HOME`).

## Showing the output

- Paste the table as-is. Do not summarize, reorder, translate or drop columns (other weekly limits such as Fable, short-term limits, banked resets).
- Add at most one or two lines after the table (for example, the account with the most room left, or a banked reset that expires soon).
- If there are "Failed" lines, relay them verbatim. Never fill in values by guessing.

## Adding accounts

If the user wants more accounts in the list, give them these commands. The browser login is theirs to complete.

```bash
# Claude: a query-only folder ~/.claude-<name>. It does not touch the login in ~/.claude.
sh <this skill's directory>/scripts/add-claude-account.sh <name> <email>
# Codex: logs in to ~/.codex-<name> (pass an existing folder's suffix to reuse it, e.g. account-b)
sh <this skill's directory>/scripts/add-codex-account.sh <name>
```

Personal and Team plans under the same email are separate accounts with separate limits, so give them separate names (for example `alex` and `alex-personal`). The "Not shown" line under the table lists folders that are not logged in.
