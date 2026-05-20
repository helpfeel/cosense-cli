# Cosenseのページを編集する手順書

CLI コマンドの仕様や実行形式は [SKILL.md](SKILL.md) を参照する。

## いつこの手順書を参照するか

ユーザーが明示的に「書き込んで」「編集して」「コメントを追記して」「修正して」等を指示した時のみ。
調査・閲覧・要約タスクでは参照しない。

## ワークフロー

以下の手順1〜4は必ず順番に実行する。

### 手順1: 編集対象のページを把握する

`readPage` で対象ページを取得し、各 line の `id` と本文を把握する。
編集に必要な anchor lineId はここから取る。

### 手順2: ops を組み立てて previewEdit でdry-runする

`cosense previewEdit <pageUrl>` の stdin に ops JSON を渡す。
入力形式・op種別・multi-line text の扱い・出力フォーマット等の詳細は `cosense previewEdit --help` を参照。

### 手順3: 出力を読んで適用後の page を確認する

意図通りの変更になっているかを確認する。 意図と違えば ops を組み直して手順2からやり直す。

### 手順4: submitEdit で確定する

`cosense submitEdit <pageUrl> <previewId>` で commit を確定する。
previewId は 1回限り (consume-on-submit)、 5分で expire する。
詳細は `cosense submitEdit --help` を参照。
