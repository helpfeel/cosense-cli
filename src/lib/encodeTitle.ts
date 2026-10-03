// 非ASCIIを生で残すと、`%2F`等と混ざったURLをmacOSのターミナルが開く時に`%`が再エンコードされ、別のページに飛ぶ
// 半角スペースはCosenseの慣習で`_`に置換する
export const encodeTitleForUrl = (title: string): string => {
  // 孤立サロゲートが残っているとencodeURIComponentが例外を投げる
  return encodeURIComponent(title.toWellFormed().replace(/ /g, '_')).replace(
    // encodeURIComponentが残すRFC 3986の予約文字。括弧はMarkdownリンクのリンク先を、`'`はshellのクォートを壊しうる
    /[!'()*]/g,
    c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
};

// Cosenseの「Copy readable link」と同じく、日本語等を生で残して人が読めるURLにする
// URLパーサーは`\`を`/`と解釈し、末尾のC0制御文字を取り除く。空白文字と`<>`は貼った先でURLの自動リンクを途中で切り、`'`はshellのクォートを壊す。これらを`/` `%` `?` `#`と共にエスケープする
export const encodeTitleForReadableLink = (title: string): string =>
  title
    .replace(/ /g, '_')
    .replace(/[/%?#\\<>\p{Cc}]|\s/gu, c => encodeURIComponent(c))
    // encodeURIComponentは`'`をエスケープしない
    .replace(/'/g, '%27');
