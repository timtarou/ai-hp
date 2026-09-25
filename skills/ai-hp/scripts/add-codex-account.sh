#!/bin/sh
# Log a Codex account into a config folder (~/.codex-<name>). Pass an existing folder's suffix
# (for example account-b for ~/.codex-account-b) to log in there. ai-hp picks up ~/.codex-* automatically.
#
#   Usage:   sh add-codex-account.sh <name>
#   Example: sh add-codex-account.sh work
set -eu

name="${1:-}"
if [ -z "$name" ]; then
  echo "Usage: sh add-codex-account.sh <name>   (logs in to ~/.codex-<name>)" >&2
  exit 2
fi
case "$name" in
  *[!A-Za-z0-9_-]*)
    echo "Use only letters, digits, - and _ in the name." >&2
    exit 2
    ;;
esac

dir="$HOME/.codex-$name"
mkdir -p "$dir"
# A folder holds one login. Refuse to overwrite an existing one.
if CODEX_HOME="$dir" codex login status 2>/dev/null | grep -q '^Logged in'; then
  echo "$dir is already logged in. Add another account under another name." >&2
  echo "To replace this login, run CODEX_HOME=$dir codex logout first." >&2
  exit 1
fi
echo "A browser login page will open. Switch the browser to the account you want to add before logging in."
CODEX_HOME="$dir" codex login
echo "---"
CODEX_HOME="$dir" codex login status
echo "---"
echo "Added: $dir (ai-hp picks it up automatically)"
echo "To run Codex with this account: CODEX_HOME=$dir codex"
