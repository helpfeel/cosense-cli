# Cosenseにログインする手順書

まずCLIコマンドの仕様を `cosense login --help` で確認する。

## 手順

Agent自身は `cosense login` を実行しない。ユーザーに以下を依頼する:

1. 別のターミナルウィンドウを開いて実行する:
   ```
   cosense login <origin>
   ```
   例: `cosense login https://scrapbox.io`
2. 表示されたPAT発行URLをブラウザで開き、Personal Access Tokenを発行する
3. ターミナルに戻ってPATを貼り付け、Enterで確定する
4. 完了をAgentに伝える

完了報告を受けたら、最初に失敗した操作をリトライする。

## 補足

- このコマンドはinteractive terminal（TTY）でのみ動作する
- 同じoriginの既存entryは上書きされる
- 401/403が解消しない場合、PATが正しく発行されているか・対象originが正しいかをユーザーに確認する
