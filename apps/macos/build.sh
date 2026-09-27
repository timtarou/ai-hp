#!/bin/bash
set -euo pipefail
repo_dir="$(cd "$(dirname "$0")/../.." && pwd)"
build_dir="$repo_dir/apps/macos/build"
app_dir="$build_dir/AI HP.app"
mkdir -p "$app_dir/Contents/MacOS" "$app_dir/Contents/Resources/cli/scripts" "$build_dir/ModuleCache"
cd "$repo_dir"
npm run build
cp -R skills/ai-hp/dist "$app_dir/Contents/Resources/cli/"
cp skills/ai-hp/package.json "$app_dir/Contents/Resources/cli/"
cp skills/ai-hp/scripts/*.sh "$app_dir/Contents/Resources/cli/scripts/"
node -e 'require("fs").writeFileSync(process.argv[1], JSON.stringify({node:process.execPath}))' "$app_dir/Contents/Resources/runtime.json"
cat > "$app_dir/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>ai.aihp.menubar</string>
<key>CFBundleName</key><string>AI HP</string>
<key>CFBundleDisplayName</key><string>AI HP</string>
<key>CFBundleExecutable</key><string>AIHP</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.1.0</string>
<key>CFBundleVersion</key><string>1</string>
<key>LSMinimumSystemVersion</key><string>13.0</string>
<key>LSUIElement</key><true/>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
xcrun swiftc -swift-version 5 -parse-as-library -O \
  -target "$(uname -m)-apple-macosx13.0" \
  -module-cache-path "$build_dir/ModuleCache" \
  apps/macos/Sources/*.swift -o "$app_dir/Contents/MacOS/AIHP"
codesign --force --sign - "$app_dir"
printf 'Built: %s\n' "$app_dir"
