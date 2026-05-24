# Cosenseのページを編集する手順書

CLI コマンドの仕様や実行形式は [SKILL.md](SKILL.md) を参照する。
各コマンドの正確な引数・入力形式・出力フォーマットは `cosense <command> --help` を見る。

## いつこの手順書を参照するか

ユーザーが明示的に「書き込んで」「編集して」「コメントを追記して」「修正して」等を指示した時のみ。
調査・閲覧・要約タスクでは参照しない。

## ワークフロー

以下の手順1〜4は必ず順番に実行する。

### 手順1: 編集対象のページを把握する

`readPage` で対象ページを取得し、`persistent` field を確認する。

- `persistent: false` (新規ページ): 続けて手順2の「新規ページ」 経路へ進む
- `persistent: true` (既存ページ): 出力の top-level `id` (= 後続コマンドが要求する pageId) と各 line の `id` (= 編集 anchor となる lineId) を把握する

### 手順2: previewEdit でdry-runする

- 新規ページ: `previewEdit --new` 経路 (プレーンテキスト本文を stdin に流す)
- 既存ページ: `previewEdit` 経路 (ops JSON を stdin に渡す)

正確な引数・入力形式・出力フォーマットは `cosense previewEdit --help` を参照。

### 手順3: 出力を読んで適用後の page を確認する

意図通りの変更になっているかを確認する。 意図と違えば ops を組み直して手順2からやり直す。

### 手順4: submitEdit で確定する

`submitEdit` で commit を確定する。 出力の `url:` で実際の page URL を確認する (新規作成時にサーバーが auto-suffix した場合はそれが反映される)。
previewId は 1回限り (consume-on-submit)、 5分で expire する。
詳細は `cosense submitEdit --help` を参照。
