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
