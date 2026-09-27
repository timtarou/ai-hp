# JSON output contract (v1)

Run `ai-hp --json` (or `node skills/ai-hp/dist/cli.js --json` from a clone).
By default, every run queries the logged-in accounts and neither reads nor writes the local usage cache. Previous observations are included only with `--include-cached`; `--fresh-only` overrides that option. An unavailable account is not replaced with an old percentage.

Usage queries emit exactly one JSON object and a trailing newline on stdout. Diagnostics, including `--debug` output, go to stderr. `--json` overrides `--markdown`, color, and commentary settings. `--help`, `--version`, and account-addition subcommands retain their existing behavior; do not combine them with a JSON usage query.

## Envelope

| Field | Meaning |
|---|---|
| `schemaVersion` | Integer `1`. Consumers should reject unsupported versions and ignore unknown fields. |
| `generatedAt` | UTC ISO 8601 timestamp at completion of collection. |
| `status` | `ok`, `partial`, `error`, or `empty`; rules below. |
| `exitCode` | Same value as the process exit code: `0` or `1`. |
| `accounts` | Fresh observations and retained cached observations, one per account key. |
| `excluded` | Sources skipped without a collection error, e.g. not logged in. |
| `issues` | Collection, CLI discovery, account warning, cache, or fatal setup problems. |

`error` means there are issues and no fresh accounts; cached accounts may still be present. `partial` means there are issues or cached accounts but the result is not `error`. `ok` means fresh accounts are present with no issues or cached accounts. `empty` means there are no accounts or issues. Excluded sources alone do not make a query fail.

Exit code `1` means `error`; all other statuses exit `0`. Always inspect stdout even after a nonzero exit. A caught fatal setup error also returns this envelope, with an empty account list and a `fatal` issue. A forcibly terminated process or a failure before JavaScript starts cannot guarantee JSON output.

## Account observations

```json
{
  "provider": "codex",
  "accountKey": "codex:example-account:you@example.com",
  "email": "you@example.com",
  "plan": "pro",
  "sources": ["/Users/example/.codex"],
  "fetchedAt": "2026-09-26T12:00:00.000Z",
  "freshness": "fresh",
  "warning": null,
  "limits": [
    {
      "kind": "weekly",
      "scope": null,
      "windowHours": null,
      "usedPercent": 42,
      "resetsAt": "2026-09-30T00:00:00.000Z"
    }
  ],
  "resetCredits": {
    "status": "available",
    "available": 0,
    "items": [],
    "note": null
  }
}
```

- `provider`: `claude` or `codex`. Treat `accountKey` as opaque. The same email with different organizations/plans can represent different accounts.
- `freshness`: `fresh` means returned by the provider CLI during this query; `cached` means recovered from ai-hp's previous observations. `fetchedAt` is when ai-hp received that observation. It does not prove that the provider CLI bypassed its own cache. Claude Code 2.1.282 can answer `get_usage` from its own short-lived snapshot, independently of ai-hp's cache option. Opt-in ai-hp cache retention is 14 days.
- `plan` and `warning`: strings or `null`. Messages are for display, not for parsing.
- `limits`: only reported limits. Each has `kind` (`weekly`, `scoped`, or `short`), nullable `scope` and `windowHours`, numeric `usedPercent`, and nullable `resetsAt`. An absent limit is not a zero-use limit and does not prove that a provider does not support it.
- Dates are UTC ISO 8601 strings or `null` when absent/invalid. A null reset time means no usable reset timestamp was reported; it must not be invented.
- `resetCredits.status`: `available` means the count was obtained, **including zero**; `unknown` means it was not obtained; `unsupported` means the collector cannot query it. The latter two return `available: null`, `items: []`, and `note: null`.
- Credit items contain `title`, `count`, nullable `grantedAt`, `startsAt`, `expiresAt`, and boolean `paused`. These are observations, not a command to redeem credits.

Accounts are sorted by upcoming weekly reset, with unknown or passed resets last, then by provider/email/account key. No observed percentage or credit count is changed based on elapsed time. In particular, cached usage does not become 0% used after a scheduled reset; a UI should show its observation time and refresh it.

## Exclusions and issues

An exclusion contains `provider`, `source`, `code`, and `message`. Stable codes are:

- `not_logged_in`
- `not_logged_in_or_api_key`
- `no_plan_limits`
- `no_weekly_limit`

An issue contains `code`, nullable `provider`, `sources` (array of paths), and `message`. Stable codes are:

- `command_not_found`
- `collection_failed`
- `account_warning`
- `cache_failed`
- `fatal`

Messages may be localized by `--lang` or contain CLI-provided details. Branch on codes, not message text. A warning can coexist with a fresh account. An exclusion can coexist with that account's cached observation. Consumers should inspect the arrays even when `status` is `ok` or `empty`.

## Cache and GUI integration

Use an absolute Node executable and the built `dist/cli.js`, passing arguments directly. The app must arrange a PATH that lets the existing CLI discovery find `claude` and `codex`.

Menu bar apps should use the default live-only behavior and allow only one query at a time. If opting into `--include-cached`, set `AI_HP_CACHE` to an absolute app-specific cache filename. The existing CLI cache uses atomic replacement to avoid partial files, but concurrent processes sharing that file are last-writer-wins and do not merge their updates. Giving the app its own cache prevents it from overwriting a terminal query's cached results. `AI_HP_CACHE` changes only the local observations cache, not the login directories.

The JSON contains account email addresses and local paths. Keep it local unless the user intends to share it.
