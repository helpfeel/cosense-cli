// 人が読める URL を作るための encoder (cosense 本家の「Copy readable link」 相当)。
// Unicode 文字 (Japanese 等) は raw のまま (browser は IRI として透過処理する)。
// cosense server の route match (`/:projectName/:title`, `:title=[^/]+`) を満たすため
// title 内の `/` は `%2F` 必須。 URL syntax を破壊する `%` `?` `#` も percent-encode する。
// space は cosense convention で `_` に置換。
export const encodeTitleForUrl = (title: string): string => {
  return title
    .replace(/%/g, '%25')
    .replace(/\//g, '%2F')
    .replace(/\?/g, '%3F')
    .replace(/#/g, '%23')
    .replace(/ /g, '_');
};
