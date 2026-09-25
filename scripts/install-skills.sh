#!/bin/sh
# Make the ai-hp skill available to both Claude Code and Codex from a clone of this repository.
# The skill stays in the repository; each tool's skill folder gets a symlink to it, so `git pull` updates both.
#   Claude Code: ~/.claude/skills/ai-hp
#   Codex      : ~/.agents/skills/ai-hp (read by every CODEX_HOME)
set -eu

SRC="$(cd "$(dirname "$0")/.." && pwd)/skills/ai-hp"

for dest in "$HOME/.claude/skills" "$HOME/.agents/skills"; do
  target="$dest/ai-hp"
  if [ -e "$target" ] && [ ! -L "$target" ]; then
    echo "A folder (not a link) already exists. Check it and remove it first: $target" >&2
    exit 1
  fi
  mkdir -p "$dest"
  ln -sfn "$SRC" "$target"
  echo "Linked: $target -> $SRC"
done
