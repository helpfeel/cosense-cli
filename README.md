# @helpfeel/cosense-cli

Cosenseのページを読み・調べ・編集するAgent SkillとCLI

## Install Agent Skill

### for Claude Code

Claude Codeを起動し、インストールコマンドを実行する

```
/plugin marketplace add helpfeel/cosense-cli
```

```
/plugin install cosense-cli@cosense-cli
```

Claude CodeはSkillの自動更新が設定可能です。 `/plugins` からMarketplaceを選択し、有効化してください。

### for Codex

Codexに入らず、ターミナルでインストールコマンドを実行する

```
npx skills install helpfeel/cosense-cli --agent codex
```

CodexはSkillの自動更新ができません。手動更新してください。

```
npx skills update cosense
```

## Install CLI

Skillの実行にはCLIが必要です

```bash
npm install -g @helpfeel/cosense-cli
cosense --help
```

## 開発

- install [direnv](https://direnv.net/)
- run `npm install`
- run `claude` or `codex`
