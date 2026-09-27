#!/bin/bash
set -euo pipefail
repo_dir="$(cd "$(dirname "$0")/../.." && pwd)"
build_dir="$repo_dir/apps/macos/build"
mkdir -p "$build_dir/ModuleCache"
cd "$repo_dir"
xcrun swiftc -swift-version 5 -module-cache-path "$build_dir/ModuleCache" \
  apps/macos/Sources/Usage.swift apps/macos/Sources/CLI.swift apps/macos/Tests/main.swift \
  -o "$build_dir/native-tests"
"$build_dir/native-tests" "$(command -v node)"
