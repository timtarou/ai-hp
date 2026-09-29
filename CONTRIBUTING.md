# Contributing

English and Japanese issues and pull requests are welcome. Describe the problem and reproduction steps before proposing a large change.

## Development

Use Node.js 24 for development and tests. The distributed CLI supports Node.js 18+.

```sh
npm ci
npm run typecheck
npm run build
npm test
```

Commit regenerated `skills/ai-hp/dist` files with TypeScript changes. Tests should use synthetic accounts rather than live credentials.

For native changes, use macOS 13+ and Apple Command Line Tools:

```sh
npm run build:macos
npm run test:macos
npm run start:macos
```

Check both light and dark appearance. The locally signed app is not a notarized release. Never commit login folders, usage snapshots, tokens or personal account details. Remove such details from screenshots and logs.

Open a pull request against `main`, explain the resulting behavior and record validation. CI checks types, generated output, CLI compatibility and the macOS app. Security vulnerabilities should be reported privately; see [SECURITY.md](SECURITY.md).
