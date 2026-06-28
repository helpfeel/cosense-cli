# Cosenseのページを編集する手順書

CLI コマンドの仕様や実行形式は [SKILL.md](SKILL.md) を参照する。
各コマンドの正確な引数・入力形式・出力フォーマットは `cosense <command> --help` を見る。

## ワークフロー

以下の手順1〜4は必ず順番に実行する。

### 手順1: 編集対象のページを把握する

`readPage` で対象ページを取得する。

注目するfield:

- `persistent`: `true` なら既存ページ編集、 `false` なら新規ページ作成
- `persistent: true` の時だけ top-level `id` を `previewEdit` の `<pageId>` に渡す
- 各 line の `id` は ops の anchor (insertBefore / replace / delete の対象) に使う
- `persistent: false` の時は `pageId` / `lineId` を使わず、 手順2で `previewEdit --new` を使う

### 手順2: previewEdit でdry-runする

- 既存ページ: `previewEdit <projectUrl> <pageId>` (stdin = ops JSON)
- 新規ページ: `previewEdit --new <projectUrl>` (stdin = プレーンテキスト本文。 1行目がページタイトル)

入力形式・出力フォーマットは `cosense previewEdit --help` を参照。

ops の組み立てwisdom:

- 特定行を複数行に分割したい時は、対象 lineId の直前に複数行を `insertBefore` してから対象行を `delete` する。 逆順にすると anchor 不在で失敗する
- ページ末尾に追記したい時は、 anchor に `_end` を指定する

#### Windowsで書き込む時

Windows 環境では本文や ops JSON を UTF-8 ファイルに書き、`previewEdit --input-file <path>` で渡す。
PowerShell の pipe 経由だと日本語が `?` に化けるため。

### 手順3: 出力を読んで適用後の page を確認する

意図通りの変更になっているかを確認する。意図と違えば ops を組み直して手順2からやり直す。

### 手順4: submitEdit で確定する

`submitEdit <projectUrl> <previewId>` を実行する。 `commitId:` が返ったら書き込み成功。 成功後は同じ `previewId` も同じ編集意図も再送しない。

`submitEdit` の response を受け取れなかった、 または結果が曖昧な時は、 再submitする前に `readPage` で対象ページを読み、 意図した変更が既に反映されていないか確認する。

## 失敗時の復旧

HTTPエラーの正確な意味は `cosense previewEdit --help` / `cosense submitEdit --help` を確認する。
ここでは編集ワークフロー上の復旧方針だけを書く。

### previewEdit

- HTTP 404: pageId が現在のページを指していない。 `readPage` からやり直し、最新の pageId を取得する。対象ページが存在しない状態なら新規作成の手順に切り替える
- HTTP 422: ops が現在のページ状態に対して不正。 `previewEdit --help` と現在の `readPage` 出力を見直して ops を組み直す

### submitEdit

- HTTP 400: preview生成時と違う projectUrl で submit している。preview生成時と同じ projectUrl が分かるなら同じ previewId で `submitEdit` をやり直す。分からなければ `previewEdit` からやり直す
- HTTP 404: previewId が使えない状態。再submitする前に `readPage` で意図した変更が既に反映されていないか確認する。未反映なら `previewEdit` からやり直す
- HTTP 409 `DuplicateTitle`: 新規作成の preview 後に同名ページが作られている。 `readPage` で同名ページを確認し、ユーザー意図が「既存に追記」なのか「別タイトルで新規」なのか判断する

### previewEdit/submitEdit 共通

- HTTP 401 / 403: 編集内容の復旧ではなく認証・権限の問題。 `login.md` を参照し、PAT・対象origin・project member権限を確認する。認証・権限を解決する前に同じ ops を繰り返し送らない
- HTTP 409 `NotFastForward`: preview生成後にページが更新されている。古い ops / previewId は再送せず、 `readPage` からやり直して `previewEdit` で新しい preview を作る
