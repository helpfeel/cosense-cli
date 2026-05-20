---
name: cosense
description: >-
  Cosense（旧Scrapbox）のページを読み・調べ・編集するスキル。
  ユーザーが「Cosenseで〇〇調べて」「このCosenseページ読んで」「Scrapboxで〇〇」「scrapbox.ioのページを見て」「このページにコメントを追記して」等と言った時に使用する。
  cosense CLIを使ってページを取得し、ユーザーの問いに情報源を示しながら答える。
---

# Cosense Skill 手順書

`cosense` CLIを使い、Cosenseのページを読み・調べてユーザーに回答する。
書き込み (ページ編集・コメント追記等) はユーザーが明示的に指示した時のみ行う。

## Cosenseとはどういう物か

Cosenseは複数のページ同士をリンクさせ、複雑な情報をナレッジグラフとして表現するweb状のWiKiである。
ページ間リンクは `[ページタイトル]` というブラケット記法で表現する。

### Cosenseを読み解く際のTips

- キーワード検索だけに頼らず、関連ページリストを眺めて、辿るべきだ。単独のページでは見えなかった文脈が浮かびあがる
- ナレッジグラフ上での被リンク数やページランク値が大きいページは、実質的にフォルダやカテゴリのような階層構造の親としても機能している
- 一見、観念的なページタイトルだけがあり、本文で何も説明されていなくても、他のページの文脈の中で説明されている事がある

## こういう時はこうする

### 調査したい時、あるいは特定のページを読みたい時

ページの読み方: [read-page.md](read-page.md)

- プロジェクト名+ページタイトルだけ指定された時は、`https://scrapbox.io/<project>/<title>` の形でCLIに渡す
  - 通常のタイトル（日本語・英数字・空白・`-`・`_`・`.` など）はそのままでよい。CLI内部の URL constructor が auto-encode する
  - タイトルに `/`・`?`・`#`・`&` 等の URL 予約文字が含まれる場合のみ、その部分を `encodeURIComponent` する
  - 空白や記号を含むURLは shell でクォート（`'...'`）で囲んで渡す

### ページを編集したい時、コメントを書き込みたい時

ページ編集手順: [edit-page.md](edit-page.md)

- ユーザーが明示的に「書き込んで」「編集して」「コメント追記して」等を指示した時のみ
- 調査・閲覧・要約タスクでは参照しない

### ログインしたい時、あるいは認証エラーが返ってきた時

ログイン手順: [login.md](login.md)

- ユーザーから「Cosenseにログインして」と明示的に指示された時
- 認証が必要なプロジェクトに `readPage` 等でアクセスし、HTTP 401 または 403 が返ってきた時

### CLIの挙動が想定と違う時

バージョン互換性チェック: [version-mismatch.md](version-mismatch.md)

- `unknown command` / `unknown option` エラー
- 戻り値JSONの構造が手順書と違う
- `--help` の出力に手順書で参照しているコマンドが無い

## CLIコマンド一覧

### CLI実行コマンド形式

- `cosense <command> <args...>` を実行する
- 事前に `npm install -g https://github.com/nota/cosense-cli` でインストールしておく
- Node 24+ 前提

### コマンド一覧

| command            | 用途                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------- |
| login              | Personal Access Tokenを設定ファイルに保存する                                                 |
| whoami             | 現在の認証ユーザーの情報を取得する                                                            |
| listProjects       | 自分が参加しているprojectの一覧を取得する                                                     |
| browseRelatedPages | 1-hop+2-hopのタイトル一覧を眺める。単独のページだけを見ていては掴みきれない文脈が浮かび上がる |
| readPage           | 単一ページを読む                                                                              |
| readProjectMembers | プロジェクトのメンバー一覧を取得する                                                          |
| listPages          | プロジェクトのページ一覧を取得する                                                            |
| list1hopLinks      | 1-hop近傍を取得する                                                                           |
| list2hopLinks      | 2-hop近傍を取得する                                                                           |
| searchVector       | ベクトル検索でページを探す（タイトル+本文中リンク記法のみ対象）                               |
| searchFullText     | 本文全文を対象に検索する                                                                      |
| search1hopLinks    | 1-hop近傍を全文検索でフィルタする                                                             |
| search2hopLinks    | 2-hop近傍を全文検索でフィルタする                                                             |
| previewEdit        | ページ編集opsをdry-runしてpreviewIdを取得する                                                 |
| submitEdit         | previewEditで取得したpreviewIdを使ってページ編集を確定する                                    |

### コマンドの詳細を知りたい時

- 全コマンド一覧と概要: `cosense --help`
- 個別コマンドの引数・戻り値スキーマ・注意点: `cosense <command> --help`
- 戻り値のJSON構造に確信が持てない時は、必ずヘルプを読んでから使う

## 回答の形式

- 情報源（ページURL）を示しながらユーザーの問いに直接答える
- 固定テンプレートは規定しない
