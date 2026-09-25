# ai-hp

**AI アカウントの HP ゲージ。** Claude Code と Codex の全アカウントについて、週間利用枠の残り・リセット日時・Banked reset を 1 つの表にまとめ、週間リセットの近い順に並べます。

Claude Code と Codex の両方で使えるスキルです（ターミナルからも実行できます）。各 CLI 自身の窓口に数字だけを問い合わせるので、会話は送らず、トークンも消費しません。

[English README](README.md)

```
### AI HP（2026-09-25 15:02 時点・my-mac・週間リセットの近い順）

| 週間 リセット | サービス | アカウント | 週間 残り | 別枠（週間） | 短期枠 | Banked reset |
|---|---|---|---|---|---|---|
| 9/26(土) 17:49（あと1日2時間） | Codex | b@example.com（pro · .codex-work） | ░░░░░░░░░░ **0%** | — | — | 1回（10/23(金) 06:01 失効） |
| 9/27(日) 04:59（あと1日13時間） | Claude | a@example.com（max · .claude） | ████████░░ 80% | Fable 100% | 5時間 59%（9/25(金) 16:49） | — |
| 9/30(水) 06:09（あと4日15時間） | Codex | c@example.com（pro · .codex） | ██░░░░░░░░ **17%** | — | — | 0 |
| 10/1(木) 08:00（あと5日16時間） | Claude | a@example.com（team · .claude-a-team） | ██████████ 100% | Fable 100% | 5時間 100%（未開始） | — |
```

## 使い方

| 使う場所 | 最初に 1 回だけ（インストール） | 実行するコマンド |
|---|---|---|
| **Claude Code** | `/plugin marketplace add timtarou/ai-hp`<br>`/plugin install ai-hp@ai-hp` | `/ai-hp:ai-hp` |
| **Codex** | Codex に次のように頼む:<br>`$skill-installer install https://github.com/timtarou/ai-hp/tree/main/skills/ai-hp into ~/.agents/skills` | `$ai-hp` |
| **ターミナル** | `git clone https://github.com/timtarou/ai-hp.git`<br>`cd ai-hp` | `npm start` |

- Claude Code と Codex では、コマンドの代わりに「利用枠を見せて」と頼んでも動きます
- **英語 / 日本語の切り替え**：Claude Code や Codex では「英語で」「日本語で」と頼みます。ターミナルでは `npm start -- --lang en`（または `ja`）。指定しなければ OS の言語設定に従います
- **ひとことを消す**：「ひとことなしで」と頼むか、`npm start -- --no-comment`
- clone して `npm run install-skills` で入れた場合（下記）は、Claude Code では `/ai-hp`、Codex では `$ai-hp` で呼びます
- **Node.js 18 以上**が必要です（依存パッケージはありません）。対象にしたい `claude` / `codex` の CLI も必要です

## 表示する内容

- **週間 リセット**：各アカウントの週間枠がいつリセットされるかと、それまでの残り時間。Claude と Codex をまたいで、この順に並べます
- **週間 残り**：10 マスの棒と、残りの割合（20% 未満は太字）
- **別枠（週間）**：Claude の **Fable** のように、別に予算を持つモデル別の週間枠
- **短期枠**：5 時間枠（Claude と、5 時間枠のある Codex のプラン）
- **Banked reset**：取っておいたリセット権の数と失効日時（Codex）。Claude の Banked reset は Claude Code の窓口から取得できないため、Claude の行は「—」になります（[表示しない理由](#claude-の-banked-reset表示しない理由)）
- 同じメールアドレスの**個人と Team** は利用枠が別なので、別の行になります
- 今回取得できなかったアカウントは、前回の値に〔○時点〕を付けて表示します
- **💬 ひとこと**：表の下に、数字に合わせたゲーム・アニメ風の一言を出します。1日以内にリセットされるのに枠が余っていれば「宝箱を開けずにダンジョンを出る気か？ 急いでぶん回せ！」、赤ゲージなら「作戦は『いのちだいじに』で」、Banked reset の失効が近ければ「ラストエリクサーは使ってこそ」、どれもほぼ枠がなければ課金のすすめ、など。スキルとして呼ぶと、Claude や Codex がその時のミームで一言を足します。`--no-comment` で消せます

## インストールの詳細

### Claude Code（プラグイン）

```
/plugin marketplace add timtarou/ai-hp
/plugin install ai-hp@ai-hp
```

実行するコマンド:

```
/ai-hp:ai-hp
```

### Codex

Codex に次のように頼みます。

```
$skill-installer install https://github.com/timtarou/ai-hp/tree/main/skills/ai-hp into ~/.agents/skills
```

`~/.agents/skills` は `CODEX_HOME` を分けた全アカウントから読まれるので、1 回入れれば全アカウントで使えます。Codex を起動し直してから、次で実行します。

```
$ai-hp
```

ネットワークと CLI のログイン情報を使うため、Codex はサンドボックス外で実行します。承認を求められたら許可してください。

### リポジトリを clone して使う（両ツール共通・`git pull` で更新）

```bash
git clone https://github.com/timtarou/ai-hp.git
cd ai-hp
npm run install-skills     # ~/.claude/skills と ~/.agents/skills にスキルへのリンクを張る
```

実行するコマンド:

```
npm start                  # ターミナル（設定の例: npm start -- --lang en --no-comment）
/ai-hp                     # Claude Code
$ai-hp                     # Codex
```

## 複数アカウント

この Mac（PC）でログインしている全アカウントを読みます。

| ツール | 読むフォルダ |
|---|---|
| Claude Code | `~/.claude` と `~/.claude-*`（`CLAUDE_CONFIG_DIR`） |
| Codex | `~/.codex` と `~/.codex-*`（`CODEX_HOME`） |

**Claude を `/login` で切り替えている場合**：`~/.claude` から読めるのは、その時ログインしているアカウントだけです。他のアカウントを問い合わせ専用のフォルダに一度ずつログインさせておくと、毎回すべてのアカウントを読めます。普段の `~/.claude` のログインや `/login` での切り替えには影響しません（Claude Code は設定フォルダごとに別のキーチェーン項目へログイン情報を保存します）。

```bash
sh skills/ai-hp/scripts/add-claude-account.sh work you@company.com
sh skills/ai-hp/scripts/add-claude-account.sh personal you@example.com
```

同じメールアドレスの個人と Team は別のアカウントです。別の名前にして、ブラウザでのログイン時にどちらの組織かを選んでください。ログイン済みのフォルダを指定すると、上書きせずに止まります。

**Codex**：アカウントごとに `CODEX_HOME` を分けて使います（例: `alias codex-work='CODEX_HOME=$HOME/.codex-work codex'`）。追加するときは次を実行します。

```bash
sh skills/ai-hp/scripts/add-codex-account.sh work
```

## 設定

```
npm start -- [--lang en|ja] [--no-comment] [--debug]
node skills/ai-hp/dist/cli.js [--lang en|ja] [--no-comment] [--debug]   # same, without npm
```

| 設定 | 引数 | 環境変数 | `config.json` | 既定 |
|---|---|---|---|---|
| 表示言語 | `--lang en\|ja` | `AI_HP_LANG` | `"lang"` | OS の言語設定 |
| タイムゾーン | | `AI_HP_TZ` | `"timeZone"` | OS のタイムゾーン |
| 表のあとの「ひとこと」 | `--no-comment` で消す | `AI_HP_COMMENTARY=0` | `"commentary": false` | 表示 |
| 生の応答を標準エラーに出す | `--debug` | `AI_HP_DEBUG=1` | | 無効 |
| 読むフォルダ | | `AI_HP_CLAUDE_DIRS`, `AI_HP_CODEX_HOMES` | | 自動検出 |

`config.json` は `~/.config/ai-hp/` に置きます（`$XDG_CONFIG_HOME/ai-hp`、Windows は `%APPDATA%\ai-hp`）。

## 仕組み

| | 取得方法 | トークン消費 |
|---|---|---|
| Claude | `claude -p` に SDK の制御要求 `get_usage` を送る（フック・プラグイン・MCP・セッション記録は読み込まない） | なし |
| Codex | `CODEX_HOME` ごとに `codex app-server` を起動し、`account/read` と `account/rateLimits/read` を送る | なし |

どちらもサーバーの現在値を返すので、強制リセットなどでリセット日時が変わっても次の実行で反映されます。各アカウントには並行して問い合わせます（全体で数秒）。前回値は `~/Library/Caches/ai-hp`（macOS）、`~/.cache/ai-hp`（Linux）、`%LOCALAPPDATA%\ai-hp`（Windows）に残し、14 日で捨てます。

### Claude の Banked reset（表示しない理由）

Claude の Banked reset は、Claude Code が外部のツールに提供している窓口（`get_usage`）に含まれないため、ai-hp では「—」と表示します。取得する方法自体はあります（Claude Code のログイン情報を使い、Claude Code を名乗って、Claude Code 自身が使う使用量 API を呼ぶ方法）。ただし ai-hp はこれを行わず、おすすめもしません。

- サブスクリプションのログイン情報を Claude Code の外で使い、公式のクライアントを装うことになります。Anthropic の規約に反し、アカウントに影響が出るおそれがあります
- 公開 API ではないため、予告なく変わる可能性があります

使える Banked reset があることは、利用上限に達したときなどに Claude Code 自身が知らせてくれます。

## 制約

- `get_usage` は Claude Code 自身が「実験的」としている機能で、`account/rateLimits/read` は Codex の app-server のプロトコルです。CLI の更新で形が変わる可能性があります。その場合、値を推測で埋めず、表の下に「取得に失敗」と理由を出します。不具合報告には `--debug` の出力が役立ちます
- 表示されるのは、実行したマシンでログインしているアカウントだけです
- アカウント追加用のスクリプトは POSIX シェル（macOS、Linux、WSL）が必要です

## 開発

ソースは `skills/ai-hp/scripts/` の TypeScript です。スキルが実行するのは `skills/ai-hp/dist/` に変換した JavaScript で、Node 18 以上で動くようリポジトリに含めています。開発には Node.js 22.18 以上が必要です（テストが TypeScript を直接実行するため）。

```bash
npm install        # TypeScript と @types/node
npm run build      # ソースを変えたら skills/ai-hp/dist を作り直す（忘れるとテストが失敗する）
npm test
npm run typecheck
```

## ライセンス

MIT
