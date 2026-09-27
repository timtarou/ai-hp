# AI HP for the macOS menu bar

Local MVP, macOS 13 or later. Uses SwiftUI and the public ai-hp JSON collector bundled inside the app. Node.js 18+ and the Claude/Codex CLIs must already be installed. No credentials are copied into the app.

## Build and run

From the repository root:

```sh
npm ci
npm run build:macos
npm run start:macos
```

Requires Apple's Command Line Tools with a Swift compiler and macOS SDK. The script compiles for the current Mac's architecture, bundles the built CLI and account-connection scripts, and applies an ad-hoc signature. The resulting app is `apps/macos/build/AI HP.app`. It can be moved outside the repository; Node and provider executables remain external dependencies.

The build records the Node executable used during the build. Change it in the app's settings if that path changes. For nonstandard Claude/Codex installations, add their containing directories to the additional CLI path setting, separated by `:`.

## Use

- Click **AI HP** in the menu bar to query accounts. The compact list always shows account identity, weekly remaining percentage and the chosen weekly reset format. Choose relative time, date/time or weekday/time under **表示項目 → リセット日時**. Hover over the reset text for the exact timestamp.
- The default order is the next upcoming weekly reset; past or unknown reset times are last. Filter by Claude/Codex, search accounts, or sort by remaining quota or account name.
- Use **表示項目** to add 5-hour and banked-credit columns, or model-specific rows below each account. All three are off initially. Optional columns widen the panel; model-specific rows expand it vertically; long lists scroll. Display options, provider filter and sort choice persist.
- The menu-bar label is **AI HP** (or **AI …** while fetching).
- Usage is fetched when the panel opens or when the refresh button is pressed. There is no launch-time query, polling timer, wake-time query or automatic retry. An already-started query may finish after the panel closes.
- **アカウントを追加** opens Terminal with `connect claude` or `connect codex`, then the provider's browser login. Complete the login yourself and click **今すぐ更新**. Config folder names are automatic. Terminal remains available to show errors or allow cancellation with Ctrl-C.
- Settings support hiding email labels and opting into login-at-startup. This may require approval in macOS System Settings, depending on the app's location/signature. It is off by default.
- Appearance follows macOS by default. Settings also offer fixed Light and Dark modes; text, backgrounds and hover styles adapt to the selected appearance.
- **終了** stops the app and cancels any current usage query.

The app invokes `--json --fresh-only`. It does not read/write the ai-hp usage cache or persist quota data. Percentages are received values, never inferred to have reset from timestamps. Every refresh clears displayed observations; a failed query does not leave an old percentage in the menu bar. Provider CLIs may have internal caches; the known Claude discrepancy is not solved by this UI.

Preferences are saved under the `ai.aihp.menubar` user defaults domain. Connection launcher scripts contain executable paths and commands, not credentials, and are stored under `~/Library/Application Support/AI HP/Connections/`.

## Validation and remaining work

The current row layout uses two lines per column: account name / provider + plan; optional 5-hour bar / remaining quota and relative reset; weekly bar / remaining quota and relative reset; optional banked-credit total / earliest expiry. Second-line text shares a baseline across columns. Fable/model-specific limits appear on a separate optional row below. Enabling columns widens the panel; enabling model-specific rows increases its height.

```sh
npm run typecheck
npm test                # Node 22.18+ required
npm run test:macos
```

Native checks cover JSON dates/nulls/schema versions, preservation of observed percentages after reset timestamps, pipe draining, handling nonzero collector exits, and cancellation. Node tests cover terminating providers when a query is cancelled. The app has also been launched locally and the account panel verified through accessibility inspection with real CLI responses.

This is not a notarized distribution. General deployment still needs a Developer ID signature, notarization, architecture/release packaging and a Node distribution decision. Browser login, login-at-startup, repeated panel opening and long-running behavior still need hands-on validation. The private repository's optional Claude banked-reset collector is not bundled in this build.

Unconnected profiles are listed in Settings instead of persistent warnings. Connection instructions clear on refresh; error notices have dismiss buttons. Account width follows displayed text, both row positions align, and pinning is removed.
