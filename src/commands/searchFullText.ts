import { parseProjectUrl } from '../lib/parseUrl.ts';
import { requestJson } from '../lib/request.ts';
import { resolveCredential } from '../lib/settings.ts';

export const searchFullTextSummary = '本文全文を対象に検索する';

export const searchFullTextHelp = `searchFullText - 本文全文を対象に検索する

Usage:
  cosense searchFullText <projectUrl> <query>

引数:
  <projectUrl>  プロジェクトのURL（例: https://scrapbox.io/shokai/）
  <query>       検索クエリ

戻り値（top-levelの主なkey）:
  projectName            string         プロジェクト名
  searchQuery            string         実行されたクエリ
  count                  number         ヒット総数
  limit                  number         1リクエストで返る上限
  pages                  Array<Page>    マッチしたページの配列
  existsExactTitleMatch  boolean        タイトル完全一致がある場合 true

各 Page の field:
  id     string    ページID
  title  string    ページタイトル
  words  string[]  マッチした語の一覧
  lines  string[]  マッチした本文の行

戻り値のJSON抜粋例:
{
  "projectName": "shokai",
  "count": 12,
  "pages": [
    { "id": "...", "title": "...", "words": ["codex"], "lines": ["...codexと相談する..."] }
  ]
}
`;

export const searchFullText = async (args: string[]): Promise<void> => {
  const [url, query] = args;
  if (!url || !query) {
    throw new Error('Usage: cosense searchFullText <projectUrl> <query>');
  }
  const { origin, projectName } = parseProjectUrl(url);
  const apiUrl = `${origin}/api/pages/${projectName}/search/query?q=${encodeURIComponent(query)}`;
  const credential = resolveCredential(origin, projectName);
  const data = await requestJson(apiUrl, { credential });
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
};
