# ai-hp

## macOSメニューバー

CLI（`skills/ai-hp`）とネイティブアプリ（`apps/macos`）は同じRepoです。Node.js 18以上、Claude/Codex CLI、macOS 13以上、Apple Command Line Toolsを用意して実行します。

```sh
npm ci
npm run build:macos
npm run start:macos
```

パネルを開くか手動更新したときに取得し、バックグラウンドの定期取得は行いません。アカウント検索、プロバイダー絞り込み、並び替え（初期値は週間リセットが近い順）に対応します。アカウント列は文字幅に合わせて伸縮し、2行の縦位置を揃えています。「表示項目」で5時間枠・バンクリセット権・Fableなどのモデル別枠を追加でき、リセット表示も「相対」「実際の日時」「曜日と時刻」から選択・保存できます。

設定でシステム連動／ライト／ダークを選べます。Pin機能は廃止しました。未ログインの設定フォルダは設定画面に表示し、接続案内は更新時に消去、取得エラーは閉じられます。[詳しい起動手順](apps/macos/README.md)も参照してください。配布用の署名・公証は未対応です。


[![npm](https://img.shields.io/npm/v/ai-hp)](https://www.npmjs.com/package/ai-hp)
[![CI](https://github.com/timtarou/ai-hp/actions/workflows/ci.yml/badge.svg)](https://github.com/timtarou/ai-hp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**AI アカウントの HP ゲージ。** Claude Code と Codex の全アカウントについて、週間利用枠の残り・リセット日時・Banked reset を 1 つの表にまとめ、週間リセットの近い順に並べます。

![ターミナルでの ai-hp。Claude Code と Codex のアカウントごとに、週間リセット・週間の残り・Fable の別枠・5 時間枠・Banked reset を 1 行で表示](https://raw.githubusercontent.com/timtarou/ai-hp/main/docs/demo-ja.png)

- **全アカウントを一度に**：個人用と仕事用（Team）、Claude Code と Codex をまたいで、週間枠のリセットが近い順に並べます
- **トークン消費ゼロ、ログイン情報に触れない**：普段使っている `claude` と `codex` の CLI に、それぞれのログインのまま数字だけを問い合わせます。会話は送らず、API キー・トークン・ブラウザの Cookie も読みません（読むのは行の見出しに使うメールアドレスだけ）
- **エージェントの中でも**：Claude Code と Codex のプラグインでもあります。「次はどのアカウントを使えばいい？」と頼めば、エージェントが表を読んで答えます
- **小さく依存ゼロ**：Node.js 18 以上、依存パッケージなし、テレメトリなし、MIT

[English README](README.md)

macOSメニューバー版のローカルMVPも利用できます。クローン内で `npm run build:macos` → `npm run start:macos` を実行してください。[起動手順と機能](apps/macos/README.md)を参照してください。

## すぐ試す

```bash
npx ai-hp
```

ターミナルではこれだけです。Claude Code や Codex の中から使うときは、スキルを入れます。

| 使う場所 | 最初に 1 回だけ（インストール） | コマンドで実行 | 言葉で頼む |
|---|---|---|---|
| **Claude Code** | `/plugin marketplace add timtarou/ai-hp`<br>`/plugin install ai-hp@ai-hp` | `/ai-hp:ai-hp` | 「利用枠はあとどれくらい？」 |
| **Codex** | `codex plugin marketplace add timtarou/ai-hp`<br>`codex plugin add ai-hp@ai-hp` | `@ai-hp` | 「AI の HP を見せて」 |
| **両方（[skills.sh](https://skills.sh)）** | `npx skills add timtarou/ai-hp -g` | `/ai-hp` または `$ai-hp` | 「利用枠のリセットはいつ？」 |
| **ターミナル** | 不要（`npx`）、または `npm install -g ai-hp` | `npx ai-hp` または `ai-hp` | — |

- Claude Code と Codex では、利用枠・残り枠・リセット日時・Banked reset について頼めば、言い方は自由です
- **英語 / 日本語の切り替え**：Claude Code や Codex では「英語で」「日本語で」と頼みます。ターミナルでは `npx ai-hp --lang en`（または `ja`）。指定しなければ OS の言語設定に従います
- **表のあとのひとこと**は既定では出しません。「ひとことも」と頼むか、`npx ai-hp --comment`
- **Node.js 18 以上**と、対象にしたい `claude` / `codex` の CLI が必要です

## 表示する内容

- **週間 リセット**：各アカウントの週間枠がいつリセットされるかと、それまでの残り時間。Claude と Codex をまたいで、この順に並べます
- **週間 残り**：10 マスの棒と、残りの割合（20% 未満は赤）
- **別枠（週間）**：Claude の **Fable** のように、別に予算を持つモデル別の週間枠
- **短期枠**：5 時間枠（Claude と、5 時間枠のある Codex のプラン）
- **Banked reset**：取っておいたリセット権の数と失効日時（Codex）。Claude の行は **「—（非対応）」** になります。Claude の Banked reset は Claude Code の窓口から取得できないため表示できない、という意味で、**0 件ではありません**（0 件のときは「0」と表示します。[表示しない理由](#claude-の-banked-reset表示しない理由)）
- 「別枠（週間）」「短期枠」の **「—」** は、そのアカウントにその枠がないという意味です
- 同じメールアドレスの**個人と Team** は利用枠が別なので、別の行になります
- 通常は今回取得できたアカウントだけを表示し、利用枠のキャッシュを読み書きしません。`--include-cached` を指定した場合だけ、前回値も〔○時点〕付きで表示します
- **💬 ひとこと**（任意）：`--comment` を付けると、表の下に、いま役立つ一言を 1 行出します（スキルとして呼ぶと、Claude や Codex がその場で書き直します）
- ターミナルの幅が足りないときは、表の代わりにアカウントごとに縦に並べます

<details>
<summary>エージェントが受け取る内容（同じ表の Markdown 版）</summary>

出力先がターミナルでないとき（スキル・パイプ・ファイル）は Markdown で出します。`--markdown` で常に Markdown にできます。

```
### AI HP（2026-09-25 15:02 時点・my-mac・週間リセットの近い順）

| 週間 リセット | サービス | アカウント | 週間 残り | 別枠（週間） | 短期枠 | Banked reset |
|---|---|---|---|---|---|---|
| 9/26(土) 17:49（あと1日2時間） | Codex | b@example.com（pro · .codex-work） | ░░░░░░░░░░ **0%** | — | — | 1回（10/23(金) 06:01 失効） |
| 9/27(日) 04:59（あと1日13時間） | Claude | a@example.com（max · .claude） | ████████░░ 80% | Fable 100% | 5時間 59%（9/25(金) 16:49） | —（非対応） |
| 9/30(水) 06:09（あと4日15時間） | Codex | c@example.com（pro · .codex） | ██░░░░░░░░ **17%** | — | — | 0 |
| 10/1(木) 08:00（あと5日16時間） | Claude | a@example.com（team · .claude-a-team） | ██████████ 100% | Fable 100% | 5時間 100%（未開始） | —（非対応） |
```

</details>

## 他の方法との違い

- **Claude Code の `/usage`、Codex の `/status`**：そのツールでいまログインしている 1 アカウントだけを表示します。ai-hp はこのマシンの全アカウントを、両ツールをまたいで次のリセット順に並べます
- **[CodexBar](https://github.com/steipete/CodexBar)**：Cursor・Gemini・Copilot など多くのサービスの利用枠をメニューバーに常に出し、通知や費用の集計もしたいなら CodexBar です。機能ははるかに多いです。ai-hp はあえて範囲を絞っています
  - トークンや Cookie を一切読みません。`claude` と `codex` の CLI に、それぞれの窓口から問い合わせるだけです。CodexBar は主に OAuth トークンやブラウザの Cookie を読み、各サービスの API を自分で呼びます
  - Claude の複数アカウントは、アカウントごとに設定フォルダ（`~/.claude-*`）へログインしておくだけで読めます。追加のツールは要りません。CodexBar で Claude の複数契約を読むには、claude-swap を使うか、トークンを設定ファイルに貼ります
  - Claude と Codex を 1 つの表にまとめて週間リセットの近い順に並べ、Claude Code と Codex のプラグインとしても動くので、エージェントに「次はどのアカウントを使えばいい？」と聞けます
- **ログの集計ツール（ccusage など）**：手元のセッション記録からトークン数や費用を見積もります。ai-hp はサーバーが返す実際の残りとリセット日時を表示します

## インストールの詳細

### ターミナル（npm）

```bash
npx ai-hp                  # インストールせずに最新版を実行
npm install -g ai-hp       # またはインストールして ai-hp で実行
```

### Claude Code（プラグイン）

```
/plugin marketplace add timtarou/ai-hp
/plugin install ai-hp@ai-hp
```

`/ai-hp:ai-hp` で実行します。「利用枠はあとどれくらい？」と頼んでも動きます。

### Codex（プラグイン）

```bash
codex plugin marketplace add timtarou/ai-hp
codex plugin add ai-hp@ai-hp
```

Codex を起動し直してから、`@` を入力して ai-hp を選びます。「AI の HP を見せて」と頼んでも動きます。更新は `codex plugin marketplace upgrade ai-hp` です。プラグインは `CODEX_HOME` ごとに入るので、使っている Codex のフォルダごとに 1 回ずつ実行してください。

ネットワークと CLI のログイン情報を使うため、Codex はサンドボックス外で実行します。承認を求められたら許可してください。

プラグインに対応していない Codex では、代わりに Codex に `$skill-installer install https://github.com/timtarou/ai-hp/tree/main/skills/ai-hp into ~/.agents/skills` と頼んでスキルを入れ、`$ai-hp` で実行します。`~/.agents/skills` は `CODEX_HOME` を分けた全アカウントから読まれます。

### skills.sh で Claude Code と Codex に入れる

```bash
npx skills add timtarou/ai-hp -g
```

[skills](https://github.com/vercel-labs/skills) の CLI が、各エージェントのスキルフォルダ（`~/.claude/skills`、`~/.agents/skills` など）にスキルを置きます。更新は `npx skills update` です。

### リポジトリを clone して使う（両ツール共通・`git pull` で更新）

```bash
git clone https://github.com/timtarou/ai-hp.git
cd ai-hp
npm run install-skills     # ~/.claude/skills と ~/.agents/skills にスキルへのリンクを張る
npm start                  # ターミナルで実行
```

Claude Code では `/ai-hp`、Codex では `$ai-hp`。言葉で頼んでも動きます。

## 複数アカウント

手軽に追加するには `npx ai-hp connect` を実行し、Claude / Codexを選んでブラウザでログインします。名前や保存先は自動で決まります。既存のログインは変更しません。

クローンした開発版では `npm start -- connect --lang ja`。サービスを直接選ぶなら `npm start -- connect claude --lang ja` または `npm start -- connect codex --lang ja` を使います。同じメールの個人・Teamプランは、ブラウザで追加したい組織を選んで別々に接続してください。

このマシンでログインしている全アカウントを読みます。

| ツール | 読むフォルダ |
|---|---|
| Claude Code | `~/.claude` と `~/.claude-*`（`CLAUDE_CONFIG_DIR`） |
| Codex | `~/.codex` と `~/.codex-*`（`CODEX_HOME`） |

**Claude を `/login` で切り替えている場合**：`~/.claude` から読めるのは、その時ログインしているアカウントだけです。他のアカウントを問い合わせ専用のフォルダに一度ずつログインさせておくと、毎回すべてのアカウントを読めます。普段の `~/.claude` のログインや `/login` での切り替えには影響しません（Claude Code は設定フォルダごとに別のキーチェーン項目へログイン情報を保存します）。

```bash
npx ai-hp add-claude work you@company.com
npx ai-hp add-claude personal you@example.com
```

同じメールアドレスの個人と Team は別のアカウントです。別の名前にして、ブラウザでのログイン時にどちらの組織かを選んでください。ログイン済みのフォルダを指定すると、上書きせずに止まります。

**Codex**：アカウントごとに `CODEX_HOME` を分けて使います（例: `alias codex-work='CODEX_HOME=$HOME/.codex-work codex'`）。追加するときは次を実行します。

```bash
npx ai-hp add-codex work
```

clone して使う場合は、同じスクリプトが `sh skills/ai-hp/scripts/add-claude-account.sh` と `add-codex-account.sh` にあります。

## 設定

```
ai-hp [--lang en|ja] [--markdown] [--json] [--include-cached] [--no-color] [--comment] [--debug]
ai-hp add-claude <名前> [メールアドレス]
ai-hp add-codex <名前>
```

| 設定 | 引数 | 環境変数 | `config.json` | 既定 |
|---|---|---|---|---|
| 表示言語 | `--lang en\|ja` | `AI_HP_LANG` | `"lang"` | OS の言語設定 |
| タイムゾーン | | `AI_HP_TZ` | `"timeZone"` | OS のタイムゾーン |
| ターミナル用の表の代わりに Markdown | `--markdown` | | | 出力先がターミナルでないとき |
| 前回値の読み書きを有効にする | `--include-cached` | | | オフ |
| アプリ向けの構造化出力 | `--json` | | | オフ。他の表示オプションより優先 |
| 色 | `--no-color` で消す | `NO_COLOR=1`、`FORCE_COLOR=1` | | ターミナルのとき |
| 表のあとの「ひとこと」 | `--comment` で出す、`--no-comment` で消す | `AI_HP_COMMENTARY=1` | `"commentary": true` | 出さない |
| 生の応答を標準エラーに出す | `--debug` | `AI_HP_DEBUG=1` | | 無効 |
| 読むフォルダ | | `AI_HP_CLAUDE_DIRS`, `AI_HP_CODEX_HOMES` | | 自動検出 |

`config.json` は `~/.config/ai-hp/` に置きます（`$XDG_CONFIG_HOME/ai-hp`、Windows は `%APPDATA%\ai-hp`）。

メニューバーアプリなどとの連携には `ai-hp --json` を使います。取得値、キャッシュの鮮度、構造化した失敗理由を、バージョン付きのJSON一件で返します。リセット予定時刻を過ぎても残量を推測で変更しません。フィールド・終了コード・専用キャッシュについては [JSON出力仕様](docs/json-output.md) を参照してください。

ai-hpのキャッシュを無効にしても、Claude Codeなど取得元CLIの内部キャッシュまでは無効にできません。ai-hpはCLIから返された値を表示するため、Web画面との即時一致を保証するものではありません。

## 仕組み

| | 取得方法 | トークン消費 |
|---|---|---|
| Claude | `claude -p` に SDK の制御要求 `get_usage` を送る（フック・プラグイン・MCP・セッション記録は読み込まない） | なし |
| Codex | `CODEX_HOME` ごとに `codex app-server` を起動し、`account/read` と `account/rateLimits/read` を送る | なし |

どちらも取得元CLIへ問い合わせ、CLIが更新した値を返した時点で強制リセットなどの変更が反映されます。各アカウントには並行して問い合わせます（全体で数秒）。ai-hp 自身はネットワークに接続せず、何も収集しません。サーバーとやり取りするのは各 CLI で、ai-hp が CLI の設定から読むのは、行の見出しとまとめに使うメールアドレスと ID だけです。`--include-cached` を指定した場合だけ、前回値を `~/Library/Caches/ai-hp`（macOS）、`~/.cache/ai-hp`（Linux）、`%LOCALAPPDATA%\ai-hp`（Windows）に残し、14 日で捨てます。

npm への公開は GitHub Actions の [trusted publishing](https://docs.npmjs.com/trusted-publishers/) で行います。npm のトークンはどこにも保存せず、この方法で公開したバージョンには、どのコミットから作られたかを示す provenance が npm 上に付きます。

### Claude の Banked reset（表示しない理由）

Claude の Banked reset は、Claude Code が外部のツールに提供している窓口（`get_usage`）に含まれないため、ai-hp では「—（非対応）」と表示します（0 件という意味ではありません）。取得する方法自体はあります（Claude Code のログイン情報を使い、Claude Code を名乗って、Claude Code 自身が使う使用量 API を呼ぶ方法）。ただし ai-hp はこれを行わず、おすすめもしません。

- サブスクリプションのログイン情報を Claude Code の外で使い、公式のクライアントを装うことになります。Anthropic の規約に反し、アカウントに影響が出るおそれがあります
- 公開 API ではないため、予告なく変わる可能性があります

使える Banked reset があることは、利用上限に達したときなどに Claude Code 自身が知らせてくれます。

## 制約

- `get_usage` は Claude Code 自身が「実験的」としている機能で、`account/rateLimits/read` は Codex の app-server のプロトコルです。CLI の更新で形が変わる可能性があります。その場合、値を推測で埋めず、表の下に「取得に失敗」と理由を出します。不具合報告には `--debug` の出力が役立ちます
- 表示されるのは、実行したマシンでログインしているアカウントだけです
- アカウントの追加（`add-claude`、`add-codex`）は POSIX シェル（macOS、Linux、WSL）が必要です

## 開発

ソースは `skills/ai-hp/scripts/` の TypeScript です。スキルが実行するのは `skills/ai-hp/dist/` に変換した JavaScript で、ビルドなしに Node 18 以上で動くようリポジトリに含めています。開発には Node.js 22.18 以上が必要です（テストが TypeScript を直接実行するため）。

```bash
npm install        # TypeScript と @types/node
npm run build      # ソースを変えたら skills/ai-hp/dist を作り直す（忘れるとテストが失敗する）
npm test
npm run typecheck
npm run demo       # 架空のアカウントで表を描く
node scripts/screenshot.ts   # docs/ の画像を作り直す（Google Chrome が必要）
```

リリースは、`package.json`・`.claude-plugin/plugin.json`・`.codex-plugin/plugin.json`・`skills/ai-hp/scripts/cli.ts` の version を上げて（テストが一致を確かめます）ビルドし、`v<version>` のタグで GitHub のリリースを公開します。リリースの workflow が npm に公開します。

## ライセンス

MIT
