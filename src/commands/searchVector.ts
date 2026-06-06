import { enrichTimestampsOf } from '../lib/enrichTimestamps.ts';
import { parseProjectUrl } from '../lib/parseUrl.ts';
import { requestJson } from '../lib/request.ts';
import { enrichPageUsers, fetchUserMap } from '../lib/resolveUsers.ts';
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
  pages  Array<Page>  類似度順のヒット結果

各 Page の field:
  title           string          ページタイトル
  image           string | null   サムネイル画像URL
  score           number          類似度スコア（高いほど近い）
  linked          number?         被リンク数
  exists          boolean         実体のあるページなら true。false の場合は空ページ（リンク記法だけ存在）

  exists=true のページのみ追加で付くfield:
    id              string          ページID
    user            User            作成者
    lastUpdateUser  User | null     最終更新者
    users           Array<User>     更新者リスト
    views           number          閲覧数
    created         string          作成日時
    updated         string          更新日時
    pageRank        number          PageRank
    linesCount      number          行数
    charsCount      number          文字数

User の field（user / lastUpdateUser / users[] で共通）:
  id           string   Cosense内部のID
  name         string?  ログイン名（自己紹介ページのタイトルや、本文中のアイコン記法で使われる）
  displayName  string?  表示名
  email        string?  メールアドレス

検索対象:
  - ページタイトル + 本文中のリンク記法（[title]）のみ
  - 本文の通常テキストは検索対象外

戻り値のJSON抜粋例:
{
  "pages": [
    { "id": "...", "title": "vibe coding", "score": 0.833, "exists": true },
    { "title": "bug修正", "score": 0.811, "linked": 3, "exists": false }
  ]
}
`;

interface SearchVectorData {
  pages?: {
    user?: { id: string } | null;
    lastUpdateUser?: { id: string } | null;
    users?: { id: string }[];
  }[];
}

export const searchVector = async (args: string[]): Promise<void> => {
  const [url, query] = args;
  if (!url || !query) {
    throw new Error('Usage: cosense searchVector <projectUrl> <query>');
  }
  const { origin, projectName } = parseProjectUrl(url);
  const apiUrl = `${origin}/api/pages/${projectName}/search/vector/titles?q=${encodeURIComponent(query)}`;
  const credential = resolveCredential(origin, projectName);
  const data = (await requestJson(apiUrl, { credential })) as SearchVectorData;

  const userMap = await fetchUserMap(origin, projectName);
  for (const page of data.pages ?? []) {
    enrichPageUsers(page, userMap);
    enrichTimestampsOf(page as Record<string, unknown>);
  }

  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
};
