# ai-hp

**An HP bar for your AI accounts.** Weekly usage limits, reset times and banked resets for all your Claude Code and Codex accounts — in one table, soonest reset first.

A skill for both Claude Code and Codex (and a plain command). It asks each CLI's own interface for the numbers, so it sends no prompts and uses no tokens.

[日本語版 README](README.ja.md)

```
### AI HP (2026-09-25 15:02 · my-mac · soonest weekly reset first)

| Weekly reset | Service | Account | Weekly left | Other weekly | Short-term | Banked resets |
|---|---|---|---|---|---|---|
| Sat 9/26 17:49 (in 1d 2h) | Codex | b@example.com (pro · .codex-work) | ░░░░░░░░░░ **0%** | — | — | 1 (expires Fri 10/23 06:01) |
| Sun 9/27 04:59 (in 1d 13h) | Claude | a@example.com (max · .claude) | ████████░░ 80% | Fable 100% | 5h 59% (Fri 9/25 16:49) | — |
| Wed 9/30 06:09 (in 4d 15h) | Codex | c@example.com (pro · .codex) | ██░░░░░░░░ **17%** | — | — | 0 |
| Thu 10/1 08:00 (in 5d 16h) | Claude | a@example.com (team · .claude-a-team) | ██████████ 100% | Fable 100% | 5h 100% (not started) | — |
```

## Usage

| Where | Install once | Run |
|---|---|---|
| **Claude Code** | `/plugin marketplace add timtarou/ai-hp`<br>`/plugin install ai-hp@ai-hp` | `/ai-hp:ai-hp` |
| **Codex** | Ask Codex:<br>`$skill-installer install https://github.com/timtarou/ai-hp/tree/main/skills/ai-hp into ~/.agents/skills` | `$ai-hp` |
| **Terminal** | `git clone https://github.com/timtarou/ai-hp.git`<br>`cd ai-hp` | `npm start` |

- In Claude Code and Codex you can also just ask: *"How much of my usage limits is left?"*
- **English or Japanese:** ask "in English" / "in Japanese" in Claude Code or Codex, or run `npm start -- --lang en` (or `ja`) in the terminal. Without it, your OS language is used.
- **No jokes:** ask for it without comments, or run `npm start -- --no-comment`.
- If you installed from a clone with `npm run install-skills` (below), the commands are `/ai-hp` in Claude Code and `$ai-hp` in Codex.
- Requires **Node.js 18+** (no dependencies) and the `claude` and/or `codex` CLIs you want to cover.

## What it shows

- **Weekly reset** — when each account's weekly limit resets, and how long until then. Rows are sorted by this, across Claude and Codex.
- **Weekly left** — a 10-cell bar plus the percentage left (bold under 20%).
- **Other weekly** — model-specific weekly limits with their own budget, such as Claude's **Fable** limit.
- **Short-term** — the 5-hour limit (Claude, and Codex plans that have one).
- **Banked resets** — resets you have in reserve, with their expiry (Codex). Claude Code does not expose Claude’s banked resets, so Claude rows show “—”.
- The same email with a **personal and a Team plan** shows as two rows, because they have separate limits.
- Accounts that could not be read this time show their last values, marked *as of …*.
- **💬 One-liners** under the table react to the numbers with game and anime flavor: burn quota that resets within a day ("Don't leave the dungeon with unopened chests!"), save an account in the red ("Tactics: don't use MP"), use a banked reset before it expires ("The Last Elixir is meant to be used"), or buy extra usage when everything is nearly empty. When run as a skill, Claude or Codex adds one more line with a timely meme. Turn them off with `--no-comment`.

## Install in detail

### Claude Code (plugin)

```
/plugin marketplace add timtarou/ai-hp
/plugin install ai-hp@ai-hp
```

Run it:

```
/ai-hp:ai-hp
```

### Codex

Ask Codex:

```
$skill-installer install https://github.com/timtarou/ai-hp/tree/main/skills/ai-hp into ~/.agents/skills
```

`~/.agents/skills` is read by every `CODEX_HOME`, so one install covers all your Codex accounts. Restart Codex, then run it:

```
$ai-hp
```

Codex runs it outside the sandbox (it needs the network and your CLI logins), so approve that when asked.

### From a clone (both tools, updates with `git pull`)

```bash
git clone https://github.com/timtarou/ai-hp.git
cd ai-hp
npm run install-skills     # symlinks the skill into ~/.claude/skills and ~/.agents/skills
```

Run it:

```
npm start                  # in the terminal (options: npm start -- --lang en --no-comment)
/ai-hp                     # in Claude Code
$ai-hp                     # in Codex
```

## Multiple accounts

ai-hp reads every account logged in on this machine:

| Tool | Folders it reads |
|---|---|
| Claude Code | `~/.claude` and `~/.claude-*` (`CLAUDE_CONFIG_DIR`) |
| Codex | `~/.codex` and `~/.codex-*` (`CODEX_HOME`) |

**Claude with `/login` switching:** only the account currently logged in to `~/.claude` can be read. Log each other account into a query-only folder once, and ai-hp reads all of them every time. Your `~/.claude` login and `/login` switching are not affected (Claude Code stores each config folder's login in a separate credential entry).

```bash
sh skills/ai-hp/scripts/add-claude-account.sh work you@company.com
sh skills/ai-hp/scripts/add-claude-account.sh personal you@example.com
```

Personal and Team plans under the same email are separate accounts: give them separate names and pick the organization during the browser login. The script refuses to overwrite a folder that is already logged in.

**Codex:** use one `CODEX_HOME` per account (for example `alias codex-work='CODEX_HOME=$HOME/.codex-work codex'`). To add one:

```bash
sh skills/ai-hp/scripts/add-codex-account.sh work
```

## Options

```
npm start -- [--lang en|ja] [--no-comment] [--debug]
node skills/ai-hp/dist/cli.js [--lang en|ja] [--no-comment] [--debug]   # same, without npm
```

| Setting | Command line | Environment | `config.json` | Default |
|---|---|---|---|---|
| Language | `--lang en\|ja` | `AI_HP_LANG` | `"lang"` | your OS locale |
| Time zone | | `AI_HP_TZ` | `"timeZone"` | your OS time zone |
| One-liners after the table | `--no-comment` to hide | `AI_HP_COMMENTARY=0` | `"commentary": false` | on |
| Raw responses to stderr | `--debug` | `AI_HP_DEBUG=1` | | off |
| Folders to read | | `AI_HP_CLAUDE_DIRS`, `AI_HP_CODEX_HOMES` | | auto-detected |

`config.json` lives in `~/.config/ai-hp/` (`$XDG_CONFIG_HOME/ai-hp`, or `%APPDATA%\ai-hp` on Windows).

## How it works

| | Source | Tokens used |
|---|---|---|
| Claude | `claude -p` with the SDK control request `get_usage` (no hooks, plugins, MCP servers or session files are loaded) | none |
| Codex | `codex app-server` per `CODEX_HOME`, with `account/read` and `account/rateLimits/read` | none |

Both return the server's current values, so a forced or early reset shows up on the next run. Accounts are queried in parallel (a few seconds in total). Last values are kept in `~/Library/Caches/ai-hp` (macOS), `~/.cache/ai-hp` (Linux) or `%LOCALAPPDATA%\ai-hp` (Windows) and dropped after 14 days.

## Limitations

- `get_usage` is marked experimental by Claude Code, and `account/rateLimits/read` belongs to Codex's app-server protocol. A CLI update can change them; ai-hp then reports the failure under the table instead of guessing values. `--debug` prints the raw responses for bug reports.
- Only accounts logged in on the machine where it runs are listed.
- The account helper scripts need a POSIX shell (macOS, Linux, WSL).

## Development

The sources are TypeScript in `skills/ai-hp/scripts/`; the skill runs the JavaScript build in `skills/ai-hp/dist/`, which is committed so that it works on Node 18+. Development needs Node.js 22.18+ (the tests run the TypeScript directly).

```bash
npm install        # TypeScript and @types/node
npm run build      # regenerate skills/ai-hp/dist after changing the sources (a test fails if you forget)
npm test
npm run typecheck
```

## License

MIT
