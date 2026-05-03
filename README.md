# @helpfeel/cosense-cli

Cosense (旧Scrapbox) のページを読み・調べるCLIとClaude Code Agent Skill。

## CLI として使う

Node.js 24+ が必要。

```bash
npm install -g @helpfeel/cosense-cli
cosense --help
```

各コマンドの詳細:

```bash
cosense <command> --help
```

## Claude Code Agent Skill として使う

Claude Codeのplugin marketplaceとして登録するとAgent Skill (`cosense`) が利用できる。

```
/plugin marketplace add nota/cosense-cli
/plugin install cosense-cli@cosense-cli
```

skillが有効になると、Claude Codeに「Cosenseで〇〇調べて」「このCosenseページ読んで」等と依頼すると自動でskillが起動する。skill側は `cosense` コマンドを呼び出すので、上記のCLIインストールも事前に必要。

## 開発

このリポジトリは CLI と Agent Skill が同居している。Agent Skill は `cosense` コマンドを呼び出すので、開発中はマシンにインストール済みの `cosense` ではなくリポジトリ内のソースを実行させたい。

[direnv](https://direnv.net/) で repo 直下の `bin/` を自動でPATHに追加する。

```bash
brew install direnv
# ~/.zshrc (or ~/.bashrc) に: eval "$(direnv hook zsh)"

cd /path/to/cosense-cli
direnv allow   # 初回のみ。.envrc を信頼する
which cosense
# → /path/to/cosense-cli/bin/cosense

claude   # この shell から Claude Code を起動すると skill が呼ぶ `cosense` は src/cli.ts を直接実行する
```

`bin/cosense` は `node src/cli.ts` に exec する単純な shell shim。`src/cli.ts` は node_modules 配下ではないので Node 24+ の type stripping がそのまま効く。リポジトリの外に cd すれば direnv が自動でPATHを元に戻す。

## License

Proprietary. Copyright Helpfeel Inc.
