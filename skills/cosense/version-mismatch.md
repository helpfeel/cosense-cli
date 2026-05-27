# CLIの挙動不一致を診断する手順書

CLIの挙動が手順書と食い違う時は、Skill version と CLI version の semver 一致ではなく、実際に使うCLIのhelpを確認する。

## 手順

1. `cosense --version` を実行し、インストール済みCLIのバージョンを控える
2. `cosense --help` を読み、使おうとしている command が存在するか確認する
3. command が存在する場合は `cosense <command> --help` を読み、必要な引数・option・戻り値・HTTPエラーが手順と合っているか確認する
4. command / option / 戻り値が手順書と食い違う場合は、ユーザーに以下を伝え、 更新後に同じ操作を再試行してもらう:
   - 発生した症状
   - インストール済みCLIバージョン (`cosense --version` の値)
   - Skill/plugin側のバージョン (`.claude-plugin/marketplace.json` の `plugins[].version`)
   - CLIまたはSkillのどちらかが古い可能性があるため更新が必要
5. help と手順書が一致している場合は、バージョン問題ではなく、認証・URL・権限・入力データ・HTTPエラーとして調査する

## 注意

- Skill/plugin version (marketplace.json) と CLI version (npm package) は管理単位が違う。major/minor が一致しないことだけで互換性問題と判定しない
- CLI最新版は `npm view @helpfeel/cosense-cli version` で確認できる
