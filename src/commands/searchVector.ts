import { parseProjectUrl } from '../lib/parseUrl.ts';
import { requestJson } from '../lib/request.ts';
import { resolveCredential } from '../lib/settings.ts';

export const searchVectorSummary =
  'ベクトル検索でページを探す（タイトル+本文中リンク記法のみ対象）';

export const searchVectorHelp = `searchVector - ベクトル検索でページを探す

Usage:
  cosense searchVector <projectUrl> <query>

引数:
  <projectUrl>  プロジェクトのURL（例: https://scrapbox.io/shokai/）
  <query>       検索クエリ

戻り値（top-levelの主なkey）:
  pages  Array<{ id, title, image, score, exists }>  類似度順のヒット結果

各 page の field:
  id      string   ページID
  title   string   ページタイトル
  image   string   サムネイル画像URL
  score   number   類似度スコア（高いほど近い）
  exists  boolean  実体のあるページなら true。false の場合は空ページ（リンク記法だけ存在）

検索対象:
  - ページタイトル + 本文中のリンク記法（[title]）のみ
  - 本文の通常テキストは検索対象外
  - 本文の語で検索したい時は searchFullText を使う

戻り値のJSON抜粋例:
{
  "pages": [
    { "id": "...", "title": "vibe coding", "score": 0.833, "exists": true },
    { "id": "...", "title": "bug修正", "score": 0.811, "exists": false }
  ]
}
`;

export const searchVector = async (args: string[]): Promise<void> => {
  const [url, query] = args;
  if (!url || !query) {
    throw new Error('Usage: cosense searchVector <projectUrl> <query>');
  }
  const { origin, projectName } = parseProjectUrl(url);
  const apiUrl = `${origin}/api/pages/${projectName}/search/vector/titles?q=${encodeURIComponent(query)}`;
  const credential = resolveCredential(origin, projectName);
  const data = await requestJson(apiUrl, { credential });
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
};
