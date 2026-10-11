# Coding Agentガイドライン

cosense skillやCLIはこのリポジトリ内にある方を使う

## タスク種別ごとの参照ドキュメント

以下に示された`docs/`ディレクトリ内のファイルを読んだ場合は、ユーザーに報告してください。
ユーザーは書かれたコードの内容の正当さを評価する時、コードそのものだけでなく、その知識背景も重視しています。

### CLIやSkillの実装・レビュー時

- CLIとSkillの責任境界ガイドライン: `docs/guidelines/cli-vs-skill.md`
  - 何にどういう役割をもたせるか説明している

### SkillのE2Eテスト時

- Agent SkillのE2Eテストでこのリポジトリに固有の事: `docs/guidelines/skill-e2e-testing.md`
  - 使わせるskillとCLI、テスト環境、修正先の切り分け、最終状態の確認方法

# AIが作業をする際の重要なルール

Claude Codeでユーザーがソフトウェア開発を始めた時にsoftware-factory-mode skillが呼び出されていなければ、「software-factory-mode skillを使う場合は、skillを呼び出してください」とユーザーに伝える。

## Gitの使い方

### git worktreeを作ったらnode_modulesを用意する

main worktreeからコピーするか、`npm ci` を実行する。

### mainブランチにcommitしない

commit前に現在のbranchを確認する。

```
git branch --show-current
```

`main` branchの場合はcommitせず停止し、変更内容に基づいた適切なbranch名を提案してユーザーに確認する

### 履歴を書き換える操作は勝手にやらない

`git commit --amend` やreflogを使った巻き戻しなど、commit済みの履歴を書き換える操作は勝手に行わない。必要だと判断した場合は、実行前にユーザーに提案して指示を仰ぐ。

### pushはユーザーの明示的な指示を待つ

commit済みの変更をpushする前に、ユーザーの明示的な指示を待つ。

## コードのformatting・linting

### コード変更後、oxfmtを実行すること

```
oxfmt <changed-file>
```

変更したファイルをformatする。個別ファイルにoxfmtを実行する方がプロジェクト全体にlintを実行するより高速。

### コード変更後にlintを実行すること

```
npm run lint
```

コード品質を保ち、追加のformatting commitを防ぐ。
コードの問題をチェックし、変更したファイルがプロジェクトのコーディング規約を満たしていることを確認する。

## pull request

draftからready for reviewに切り替える時に、please reviewラベルを付ける。
