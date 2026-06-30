# Coding Agentガイドライン

cosense skillやCLIはこのリポジトリ内にある方を使う

## タスク種別ごとの参照ドキュメント

以下に示された`docs/`ディレクトリ内のファイルを読んだ場合は、ユーザーに報告してください。
ユーザーは書かれたコードの内容の正当さを評価する時、コードそのものだけでなく、その知識背景も重視しています。

### CLIやSkillの実装・レビュー時

- CLIとSkillの責任境界ガイドライン: `docs/guidelines/cli-vs-skill.md`
  - 何にどういう役割をもたせるか説明している

# AIが作業をする際の重要なルール

コード変更後の基本フロー:

1. plan modeで実装した場合はbug確認
2. formatterを実行
3. linterを実行
4. 必要に応じてcommit（ただしmainには直接commitしない）
5. pushはユーザーの明示的な指示を待つ

各手順の詳細は以下のセクションを参照。

## Gitの使い方

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

## plan modeで実装した後にやること

### bugがないか確認する

codex-consultation スキルでよく相談し、実装内容を確認する。
単純なbugであれば修正する。解決方法が複数ある場合はユーザーに質問する。
