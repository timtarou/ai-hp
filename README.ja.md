# ai-hp

[![npm](https://img.shields.io/npm/v/ai-hp)](https://www.npmjs.com/package/ai-hp)
[![CI](https://github.com/timtarou/ai-hp/actions/workflows/ci.yml/badge.svg)](https://github.com/timtarou/ai-hp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**AI アカウントの HP ゲージ。** Claude Code と Codex の全アカウントについて、週間利用枠の残り・リセット日時・Banked reset を 1 つの表にまとめ、週間リセットの近い順に並べます。

![ターミナルでの ai-hp。Claude Code と Codex のアカウントごとに、週間リセット・週間の残り・Fable の別枠・5 時間枠・Banked reset を 1 行で表示](https://raw.githubusercontent.com/timtarou/ai-hp/main/docs/demo-ja.png)

- **全アカウントを一度に**：個人用と仕事用（Team）、Claude Code と Codex をまたいで、週間枠のリセットが近い順に並べます
- **トークン消費ゼロ、ログイン情報に触れない**：普段使っている `claude` と `codex` の CLI に、それぞれのログインのまま数字だけを問い合わせます。会話は送らず、API キー・トークン・ブラウザの Cookie も読みません（読むのは行の見出しに使うメールアドレスだけ）
- **エージェントの中でも**：Claude Code と Codex のスキルでもあります。「次はどのアカウントを使えばいい？」と頼めば、エージェントが表を読んで答えます
- **小さく依存ゼロ**：Node.js 18 以上、依存パッケージなし、テレメトリなし、MIT

[English README](README.md)

## すぐ試す

```bash
npx ai-hp
```

ターミナルではこれだけです。Claude Code や Codex の中から使うときは、スキルを入れます。

| 使う場所 | 最初に 1 回だけ（インストール） | コマンドで実行 | 言葉で頼む |
|---|---|---|---|
| **Claude Code** | `/plugin marketplace add timtarou/ai-hp`<br>`/plugin install ai-hp@ai-hp` | `/ai-hp:ai-hp` | 「利用枠はあとどれくらい？」 |
| **Codex** | Codex に次のように頼む:<br>`$skill-installer install https://github.com/timtarou/ai-hp/tree/main/skills/ai-hp into ~/.agents/skills` | `$ai-hp` | 「AI の HP を見せて」 |
| **両方（[skills.sh](https://skills.sh)）** | `npx skills add timtarou/ai-hp -g` | `/ai-hp` または `$ai-hp` | 「利用枠のリセットはいつ？」 |
| **ターミナル** | 不要（`npx`）、または `npm install -g ai-hp` | `npx ai-hp` または `ai-hp` | — |

- Claude Code と Codex では、利用枠・残り枠・リセット日時・Banked reset について頼めば、言い方は自由です
- **英語 / 日本語の切り替え**：Claude Code や Codex では「英語で」「日本語で」と頼みます。ターミナルでは `npx ai-hp --lang en`（または `ja`）。指定しなければ OS の言語設定に従います
- **ひとことを消す**：「ひとことなしで」と頼むか、`npx ai-hp --no-comment`
- **Node.js 18 以上**と、対象にしたい `claude` / `codex` の CLI が必要です

## 表示する内容

- **週間 リセット**：各アカウントの週間枠がいつリセットされるかと、それまでの残り時間。Claude と Codex をまたいで、この順に並べます
- **週間 残り**：10 マスの棒と、残りの割合（20% 未満は赤）
- **別枠（週間）**：Claude の **Fable** のように、別に予算を持つモデル別の週間枠
- **短期枠**：5 時間枠（Claude と、5 時間枠のある Codex のプラン）
- **Banked reset**：取っておいたリセット権の数と失効日時（Codex）。Claude の行は **「—（非対応）」** になります。Claude の Banked reset は Claude Code の窓口から取得できないため表示できない、という意味で、**0 件ではありません**（0 件のときは「0」と表示します。[表示しない理由](#claude-の-banked-reset表示しない理由)）
- 「別枠（週間）」「短期枠」の **「—」** は、そのアカウントにその枠がないという意味です
- 同じメールアドレスの**個人と Team** は利用枠が別なので、別の行になります
- 今回取得できなかったアカウントは、前回の値に〔○時点〕を付けて表示します
- **💬 ひとこと**：表の下に、いま役立つ一言を 1 行（スキルとして呼ぶと、Claude や Codex がその場で書き直します）。`--no-comment` で消せます
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
  - Claude と Codex を 1 つの表にまとめて週間リセットの近い順に並べ、Claude Code のプラグインと Codex のスキルとしても動くので、エージェントに「次はどのアカウントを使えばいい？」と聞けます
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

### Codex

Codex に次のように頼みます。

```
$skill-installer install https://github.com/timtarou/ai-hp/tree/main/skills/ai-hp into ~/.agents/skills
```

`~/.agents/skills` は `CODEX_HOME` を分けた全アカウントから読まれるので、1 回入れれば全アカウントで使えます。Codex を起動し直してから `$ai-hp` で実行します。「AI の HP を見せて」と頼んでも動きます。

ネットワークと CLI のログイン情報を使うため、Codex はサンドボックス外で実行します。承認を求められたら許可してください。

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
ai-hp [--lang en|ja] [--markdown] [--no-color] [--no-comment] [--debug]
ai-hp add-claude <名前> [メールアドレス]
ai-hp add-codex <名前>
```

| 設定 | 引数 | 環境変数 | `config.json` | 既定 |
|---|---|---|---|---|
| 表示言語 | `--lang en\|ja` | `AI_HP_LANG` | `"lang"` | OS の言語設定 |
| タイムゾーン | | `AI_HP_TZ` | `"timeZone"` | OS のタイムゾーン |
| ターミナル用の表の代わりに Markdown | `--markdown` | | | 出力先がターミナルでないとき |
| 色 | `--no-color` で消す | `NO_COLOR=1`、`FORCE_COLOR=1` | | ターミナルのとき |
| 表のあとの「ひとこと」 | `--no-comment` で消す | `AI_HP_COMMENTARY=0` | `"commentary": false` | 表示 |
| 生の応答を標準エラーに出す | `--debug` | `AI_HP_DEBUG=1` | | 無効 |
| 読むフォルダ | | `AI_HP_CLAUDE_DIRS`, `AI_HP_CODEX_HOMES` | | 自動検出 |

`config.json` は `~/.config/ai-hp/` に置きます（`$XDG_CONFIG_HOME/ai-hp`、Windows は `%APPDATA%\ai-hp`）。

## 仕組み

| | 取得方法 | トークン消費 |
|---|---|---|
| Claude | `claude -p` に SDK の制御要求 `get_usage` を送る（フック・プラグイン・MCP・セッション記録は読み込まない） | なし |
| Codex | `CODEX_HOME` ごとに `codex app-server` を起動し、`account/read` と `account/rateLimits/read` を送る | なし |

どちらもサーバーの現在値を返すので、強制リセットなどでリセット日時が変わっても次の実行で反映されます。各アカウントには並行して問い合わせます（全体で数秒）。ai-hp 自身はネットワークに接続せず、何も収集しません。サーバーとやり取りするのは各 CLI で、ai-hp が CLI の設定から読むのは、行の見出しとまとめに使うメールアドレスと ID だけです。前回値は `~/Library/Caches/ai-hp`（macOS）、`~/.cache/ai-hp`（Linux）、`%LOCALAPPDATA%\ai-hp`（Windows）に残し、14 日で捨てます。

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

リリースは、`package.json`・`.claude-plugin/plugin.json`・`skills/ai-hp/scripts/cli.ts` の version を上げて（テストが一致を確かめます）ビルドし、`v<version>` のタグで GitHub のリリースを公開します。リリースの workflow が npm に公開します。

## ライセンス

MIT
