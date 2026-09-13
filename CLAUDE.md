# Coding Agentガイドライン

cosense skillやCLIはこのリポジトリ内にある方を使う

## タスク種別ごとの参照ドキュメント

以下に示された`docs/`ディレクトリ内のファイルを読んだ場合は、ユーザーに報告してください。
ユーザーは書かれたコードの内容の正当さを評価する時、コードそのものだけでなく、その知識背景も重視しています。

### CLIやSkillの実装・レビュー時

- CLIとSkillの責任境界ガイドライン: `docs/guidelines/cli-vs-skill.md`
  - 何にどういう役割をもたせるか説明している

### SkillのE2Eテスト時

- Agent SkillのE2Eテスト手順: `docs/guidelines/skill-e2e-testing.md`
  - subagentにskillの手順書だけでワークフローを完遂させ、その不備を検証する方法

### pull requestの作成・更新・レビュー時

- PR作成とレビューの手順: `docs/guidelines/pull-request-and-review.md`
  - draft運用、対話コンテキストのexport、インラインレビューコメントの草稿、sanity-review

# AIが作業をする際の重要なルール

コード変更後の基本フロー:

1. 変更が一段落したらbug確認
2. formatterを実行
3. linterを実行
4. 必要に応じてcommit（ただしmainには直接commitしない）
5. pushはユーザーの明示的な指示を待つ
6. PR作成を指示されたらdraftで作成し、対話コンテキストをexport
7. sanity-reviewはユーザーの指示を待ち、指摘対応をpushしてからready for review

各手順の詳細は以下のセクションを参照。6・7の手順は `docs/guidelines/pull-request-and-review.md` に従う。

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
作成済みのPRがあるbranchにpushしたら、`docs/guidelines/pull-request-and-review.md` に従って対話コンテキストをexportする。

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

## 変更が一段落したらやること

### bugがないか確認する

codex-consultation スキルでよく相談し、実装内容を確認する。
単純なbugであれば修正する。解決方法が複数ある場合はユーザーに質問する。

### Codex CLIが使えない場合

Codex CLIが無い環境（Claude Code on the web等）では、subagent-consultation スキルにフォールバックし、報告にその旨を明記する。
Codexが利用制限や通信障害等で使えなくなった時はフォールバックせず、ユーザーに報告して判断を仰ぐ。
