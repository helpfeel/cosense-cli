# Agent SkillのE2Eテスト

手順はskill-usability-test skillに従う。このファイルは、その手順をこのリポジトリで行う時に固有の事だけを補う。

## 使わせるskillとCLI

検証対象のworktreeにある`skills/cosense/`と`bin/cosense`を使わせる。`cosense <command>`を`<worktree>/bin/cosense <command>`に読み替える指示をプロンプトに含める。

## テスト環境

ローカル開発環境か、scrapbox.ioに用意したテスト用projectを使う。どちらの環境のどのprojectを使うかは、テスト実行前にユーザーに質問して決める。

## 穴を埋める時の修正先

CLIとSkillのどちらを直すかは`docs/guidelines/cli-vs-skill.md`に従って切り分ける。

## 最終状態の確認

readPage等で対象ページを直接読む。
