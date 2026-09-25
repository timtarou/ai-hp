#!/bin/sh
# Log another Claude account into a query-only folder (~/.claude-<name>) so that ai-hp can
# read its limits every time. The login in ~/.claude (and switching with /login) is not affected:
# Claude Code keeps each config folder's login in its own credential entry.
#
#   Usage:   sh add-claude-account.sh <name> [email]
#   Example: sh add-claude-account.sh alex-personal alex@example.com
set -eu

name="${1:-}"
if [ -z "$name" ]; then
  echo "Usage: sh add-claude-account.sh <name> [email]" >&2
  exit 2
fi
case "$name" in
  *[!A-Za-z0-9_-]*)
    echo "Use only letters, digits, - and _ in the name." >&2
    exit 2
    ;;
esac

dir="$HOME/.claude-$name"
mkdir -p "$dir"
# A folder holds one login. Refuse to overwrite an existing one
# (personal and Team plans under the same email go into separate folders).
if CLAUDE_CONFIG_DIR="$dir" claude auth status 2>/dev/null | grep -q '"loggedIn": true'; then
  echo "$dir is already logged in:" >&2
  CLAUDE_CONFIG_DIR="$dir" claude auth status 2>/dev/null | grep -E '"(email|orgName|subscriptionType)"' >&2 || true
  echo "Add another account (including the personal/Team plan of the same email) under another name, e.g. sh add-claude-account.sh ${name}-personal" >&2
  echo "To replace this login, run CLAUDE_CONFIG_DIR=$dir claude auth logout first." >&2
  exit 1
fi
echo "A browser login page will open. Switch the browser to the account you want to add before logging in."
echo "If the email has both a personal and a Team plan, pick the organization you want during login."
if [ -n "${2:-}" ]; then
  CLAUDE_CONFIG_DIR="$dir" claude auth login --claudeai --email "$2"
else
  CLAUDE_CONFIG_DIR="$dir" claude auth login --claudeai
fi
echo "---"
CLAUDE_CONFIG_DIR="$dir" claude auth status
echo "---"
echo "Added: $dir (ai-hp picks it up automatically)"
