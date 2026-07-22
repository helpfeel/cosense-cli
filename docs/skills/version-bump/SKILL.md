---
name: version-bump
description: >-
  CLIまたはAgent Skillのバージョンを上げるskill。
  ユーザーが「バージョンを上げて」「version bump して」「リリース準備して」「新しいバージョンを切って」等と言った時に使用する。
  対象（CLI / Agent Skill）を確認し、前回リリース以降の変更を提示してbump種別を決め、ローカルにcommitとtagを作る。
---

# version-bump 手順書

このリポジトリには独立してリリースされる2つのプロダクトがある。

- **CLI** (`@helpfeel/cosense-cli`, npm公開): バージョンは `package.json`
- **Agent Skill** (Claude plugin): バージョンは `.claude-plugin/marketplace.json`

それぞれ別の番号・別のタイミングでリリースされる。この手順書は、対象を選んで正しい手順でバージョンを上げる。

## このskillがやること・やらないこと

- **やる**: バージョン番号の更新、commit、tag作成（すべてローカル）
- **やらない**: `git push` と `npm publish`。これらは不可逆な外部公開なので、AIは実行しない。

## Step 0: 対象を質問する

どれをbumpするかユーザーに質問する。

- **CLI** — npmパッケージ
- **Agent Skill** — Claude plugin

## 前提チェック（bump前に必ず確認）

1. 現在のbranchが `main` か確認する。`git branch --show-current` が `main` でなければ、止めてユーザーに確認する。
2. working treeがクリーンか確認する。`git status --porcelain` に出力があれば止める。無関係な変更をリリースcommitに混ぜない。また `npm version` はダーティなツリーで失敗する。

## CLIフロー

1. 前回リリース地点を特定する。

   ```
   git describe --tags --abbrev=0 --match 'v*'
   ```

2. 前回リリース以降のCLI変更を提示する。

   ```
   git log --oneline <前回tag>..HEAD -- src/ bin/ package.json
   ```

   変更が空なら、bumpに進まず「対象変更なし。空リリースを作るか」をユーザーに確認する。

3. 上の変更一覧を根拠に、ユーザーへ `major` / `minor` / `patch` のどれにするか質問する。
4. `npm run lint` を通す。壊れた状態のコードにタグを打たない。失敗したら止めて報告する。
5. これから作るtag `vX.Y.Z` が既に存在しないか確認する。存在したら止める（リリース途中/番号衝突の可能性）。

   ```
   git rev-parse -q --verify refs/tags/vX.Y.Z
   ```

6. bumpを実行する。`<type>` はStep 3でユーザーが選んだもの。

   ```
   npm version <type>
   ```

   これで `package.json` と `package-lock.json` のversionが更新され、commit `X.Y.Z` と annotated tag `vX.Y.Z` が作られる（npmが自動で行う）。

## Skillフロー

1. 前回リリース地点を特定する。まず `skill-v*` タグを探し、**終了コードで**フォールバックを判断する（`fatal` の文言に依存しない）。

   ```
   git describe --tags --abbrev=0 --match 'skill-v*'
   ```

   これが失敗（exit≠0）した場合は、旧いcommit規約にフォールバックする。`skill version 0.2.0` のような別形式を拾わないよう `[0-9]` でアンカーする。

   ```
   git log --first-parent --grep='^skill v[0-9]' -1 --format=%H
   ```

   タグも旧release commitも無い場合は初回リリースとして全履歴を対象にする。

2. 前回リリース以降のSkill変更を提示する。`<境界>` はStep 1で得たtagまたはcommit。

   ```
   git log --oneline <境界>..HEAD -- skills/ .claude-plugin/
   ```

   変更が空なら、bumpに進まず「対象変更なし。空リリースを作るか」をユーザーに確認する。

3. 上の変更一覧を根拠に、ユーザーへ `major` / `minor` / `patch` のどれにするか質問する。
4. `.claude-plugin/marketplace.json` の `plugins[]` から `name` が `cosense-cli` のエントリを1件特定し、その `version` を読む（該当が0件または複数件なら止める）。値が `X.Y.Z` 形式でなければ止める。選んだ種別で次の番号を算出する。
   - major: `X.Y.Z` → `(X+1).0.0`
   - minor: `X.Y.Z` → `X.(Y+1).0`
   - patch: `X.Y.Z` → `X.Y.(Z+1)`
5. そのエントリの `version` を新しい番号に書き換える。
6. manifestを検証する。失敗したら止めて報告する。

   ```
   claude plugin validate . --strict
   ```

7. これから作るtag `skill-vX.Y.Z` が既に存在しないか確認する。存在したら止める。

   ```
   git rev-parse -q --verify refs/tags/skill-vX.Y.Z
   ```

8. commitと annotated tag を作る。CLIのtag（`npm version` が作るannotated tag）と形式を揃えるため `-a` を付ける。

   ```
   git add .claude-plugin/marketplace.json
   git commit -m "skill vX.Y.Z"
   git tag -a skill-vX.Y.Z -m "skill vX.Y.Z"
   ```
