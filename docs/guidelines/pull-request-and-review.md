# pull requestの作成とレビュー

## pull requestの作成

### PRはdraftで作成する

draftは実装者が仕上げている途中の状態で、AIによるレビューはこの間に済ませる。ready for reviewは人間にレビューを依頼できる状態を表し、AIレビュー待ちの意味では使わない。

### PRを作成したら、また作成後にpushしたら対話コンテキストをexportする

conversation-context-export スキルを実行する。
worktreeで作業している場合は、出力先をmain worktreeの `.dev/contexts/` にする。

### PRを作成したらインラインレビューコメントの草稿を書く

ユーザーがレビュアーに実装を説明するためのインラインレビューコメントの草稿を書き、ユーザーに提示する。重要な変更に絞り、ファイル名と行番号を付ける。

## レビュー

### sanity-reviewは実装者が行う

sanity-review スキルの実行者はレビュアーではなく実装者。概要欄とインラインレビューコメントを書き終えてから、レビュアーに依頼する前に実行する。

### 開発したsessionでsanity-reviewを依頼された時

開発sessionの会話履歴を引き継がないOpusのsubagentを起動する。
subagentにはPRのURL、実行条件、報告書の出力先だけを渡す。skillのフォールバック手順を使わない事も指示に含める。

### sanity-reviewの前提

- 対話コンテキストがPRコメントに投稿されている事
- 同じマシンにCodex CLIがある事。Codex CLIが無ければ実行せず、Codexとの相談に失敗したら中止する
- Opus以上を使う。Sonnetではレビューできない

### sanity-reviewが済むまでPRはdraftのままにする

指摘への対応をpushし終えてから、実装者がdraftからready for reviewに切り替え、please reviewラベルを付ける
