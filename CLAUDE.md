# Coding Agentガイドライン

## タスク種別ごとの参照ドキュメント

以下に示された`docs/`ディレクトリ内のファイルを読んだ場合は、ユーザーに報告してください。
ユーザーは書かれたコードの内容の正当さを評価する時、コードそのものだけでなく、その知識背景も重視しています。

### CLIやSkillの実装・レビュー時

- CLIとSkillの責任境界ガイドライン: `docs/guidelines/cli-vs-skill.md`
  - 何にどういう役割をもたせるか説明している

# AIが作業をする際の重要なルール

コード変更後の基本フロー:

1. formatterを実行
2. linterを実行
3. plan modeで実装した場合はbug確認
4. ユーザーのレビューを待つ
5. 明示的な指示があればcommit

各手順の詳細は以下のセクションを参照。

## Gitの使い方

### `git -C`は使用禁止

gitコマンドはproject rootディレクトリから実行すること。

### リポジトリ内のファイルを移動する際は`git mv`を使う

```
git mv old_path new_path
```

これによりGitでファイル履歴が保持される。
`mv`コマンドでファイル移動すると、Gitはファイルの削除と新規作成として認識し、履歴が失われる可能性がある。

### commitはユーザーの明示的な指示を待つこと

依頼されたコード変更を行った後、勝手にcommitしない。
ユーザーのレビューを待つ。

「git commit」「commitして」等の明示的な指示があった場合のみ、commitする

### mainブランチにcommitしない

commit前に現在のbranchを確認する。

```
git branch --show-current
```

`main` branchの場合はcommitせず停止し、変更内容に基づいた適切なbranch名を提案してユーザーに確認する

## コードのformatting・linting

### コード変更後、oxfmtを実行すること

```
oxfmt <changed-file>
```

変更したファイルをformatする。個別ファイルにoxfmtを実行する方がプロジェクト全体にlintを実行するより高速。

### コード変更後およびgit commit前にlintを実行すること

```
npm run lint
```

コード品質を保ち、追加のformatting commitを防ぐ。
コードの問題をチェックし、変更したファイルがプロジェクトのコーディング規約を満たしていることを確認する。

## plan modeで実装した後にやること

### bugがないか確認する

codex-consultation スキルを実行して実装内容を確認する。相談回数は1往復でよい。
単純なbugであれば修正する。解決方法が複数ある場合はユーザーに質問する。
