---
name: version-bump
description: >-
  CLIまたはAgent Skillのバージョンを上げるskill。
  ユーザーが「バージョンを上げて」「version bump して」「リリース準備して」「新しいバージョンを切って」等と言った時に使用する。
  前回リリース以降の変更を調べた上で対象（CLI / Agent Skill / 両方）を確認し、bump種別を決め、ローカルにcommitとtagを作る。
---

# version-bump 手順書

このリポジトリには独立してリリースされる2つのプロダクトがある。

- **CLI** (`@helpfeel/cosense-cli`, npm公開): バージョンは `package.json`
- **Agent Skill** (Claude plugin): バージョンは `.claude-plugin/marketplace.json`

それぞれ別の番号・別のタイミングでリリースされる。この手順書は、対象を選んで正しい手順でバージョンを上げる。

## このskillがやること・やらないこと

- **やる**: バージョン番号の更新、commit、tag作成（すべてローカル）
- **やらない**: `git push` と `npm publish`。これらは不可逆な外部公開なので、AIは実行しない。

## 前提チェック（調査前に必ず確認）

1. 現在のbranchが `main` か確認する。`git branch --show-current` が `main` でなければ、止めてユーザーに確認する。
2. working treeがクリーンか確認する。`git status --porcelain` に出力があれば止める。無関係な変更をリリースcommitに混ぜない。また `npm version` はダーティなツリーで失敗する。

## Step 0: 両方の未リリース変更を調べてから対象を質問する

ユーザーは「どちらに未リリース変更があるか」を材料に対象を決める。質問より先に、CLIとSkillの両方を調べる。

1. CLIの前回リリース地点を特定する。

   ```
   git describe --tags --abbrev=0 --match 'v*'
   ```

2. Skillの前回リリース地点を特定する。まず `skill-v*` タグを探し、**終了コードで**フォールバックを判断する（`fatal` の文言に依存しない）。

   ```
   git describe --tags --abbrev=0 --match 'skill-v*'
   ```

   これが失敗（exit≠0）した場合は、旧いcommit規約にフォールバックする。`skill version 0.2.0` のような別形式を拾わないよう `[0-9]` でアンカーする。

   ```
   git log --first-parent --grep='^skill v[0-9]' -1 --format=%H
   ```

   タグも旧release commitも無い場合は初回リリースとして全履歴を対象にする。

3. それぞれの未リリース変更を取得する。`<CLI境界>` `<Skill境界>` はStep 1・2で得たtagまたはcommit。

   ```
   git log --oneline <CLI境界>..HEAD -- src/ bin/ package.json
   git log --oneline <Skill境界>..HEAD -- skills/ .claude-plugin/
   ```

4. 調べた両方の変更一覧を提示した上で、どれをbumpするかユーザーに質問する。選択肢には各対象の現在のバージョンと未リリース変更の件数を含め、変更が0件の対象はそれと分かるようにする。

   - **CLI** — npmパッケージ
   - **Agent Skill** — Claude plugin
   - **両方** — CLIフローを完了させてからSkillフローに進む。Skillフローを先にやるとworking treeが汚れ、`npm version` が失敗する

   変更が0件の対象が選ばれた場合は、bumpに進まず「対象変更なし。空リリースを作るか」をユーザーに確認する。

## CLIフロー

1. Step 0で提示したCLIの変更一覧を根拠に、ユーザーへ `major` / `minor` / `patch` のどれにするか質問する。
2. `npm run lint` を通す。壊れた状態のコードにタグを打たない。失敗したら止めて報告する。
3. これから作るtag `vX.Y.Z` が既に存在しないか確認する。存在したら止める（リリース途中/番号衝突の可能性）。

   ```
   git rev-parse -q --verify refs/tags/vX.Y.Z
   ```

4. bumpを実行する。`<type>` はStep 1でユーザーが選んだもの。

   ```
   npm version <type>
   ```

   これで `package.json` と `package-lock.json` のversionが更新され、commit `X.Y.Z` と annotated tag `vX.Y.Z` が作られる（npmが自動で行う）。

## Skillフロー

1. Step 0で提示したSkillの変更一覧を根拠に、ユーザーへ `major` / `minor` / `patch` のどれにするか質問する。
2. `.claude-plugin/marketplace.json` の `plugins[]` から `name` が `cosense-cli` のエントリを1件特定し、その `version` を読む（該当が0件または複数件なら止める）。値が `X.Y.Z` 形式でなければ止める。選んだ種別で次の番号を算出する。
   - major: `X.Y.Z` → `(X+1).0.0`
   - minor: `X.Y.Z` → `X.(Y+1).0`
   - patch: `X.Y.Z` → `X.Y.(Z+1)`
3. そのエントリの `version` を新しい番号に書き換える。
4. manifestを検証する。失敗したら止めて報告する。

   ```
   claude plugin validate . --strict
   ```

5. これから作るtag `skill-vX.Y.Z` が既に存在しないか確認する。存在したら止める。

   ```
   git rev-parse -q --verify refs/tags/skill-vX.Y.Z
   ```

6. commitと annotated tag を作る。CLIのtag（`npm version` が作るannotated tag）と形式を揃えるため `-a` を付ける。

   ```
   git add .claude-plugin/marketplace.json
   git commit -m "skill vX.Y.Z"
   git tag -a skill-vX.Y.Z -m "skill vX.Y.Z"
   ```
