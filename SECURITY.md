# Security policy

Security fixes target the latest release and `main`.

Please do not post credentials or exploitable vulnerabilities in public issues. Use **Security → Report a vulnerability** on this repository to contact the maintainer privately. Include the affected version, reproduction steps and impact using synthetic data. Do not include real access tokens, account credentials or private usage data.

ai-hp runs locally and uses installed provider CLIs. The public edition does not read Claude Keychain credentials for banked resets. The menu bar app bundles the collector, but Node.js and the provider CLIs remain external dependencies.

日本語での報告も歓迎します。認証情報や悪用可能な脆弱性は公開Issueへ投稿せず、GitHubの **Security → Report a vulnerability** から非公開で報告してください。
