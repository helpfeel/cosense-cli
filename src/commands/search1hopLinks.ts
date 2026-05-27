import { fetchRelatedPagesWithRelations } from '../lib/annotateRelations.ts';
import { enrichTimestampsOf } from '../lib/enrichTimestamps.ts';
import { parsePageUrl } from '../lib/parseUrl.ts';
import { enrichPageUsers, fetchUserMap } from '../lib/resolveUsers.ts';

export const search1hopLinksSummary = '1-hop近傍を全文検索でフィルタする';

export const search1hopLinksHelp = `search1hopLinks - 1-hop近傍を全文検索でフィルタする

Usage:
  cosense search1hopLinks <pageUrl> <query>

引数:
  <pageUrl>  対象ページの完全なURL
  <query>    全文検索クエリ（必須・空文字は弾かれる）

戻り値（top-levelの主なkey）:
  links1hop  Array<Link>  query を本文に含む1-hop近傍ページ
  ほか list1hopLinks と同じ top-level key

各 Link の field（list1hopLinksに加えて）:
  search  検索ハイライト情報

検索の制約:
  - OR検索不可
`;

export const search1hopLinks = async (args: string[]): Promise<void> => {
  const [url, query] = args;
  if (args.length !== 2 || !url || !query || query.trim() === '') {
    throw new Error('Usage: cosense search1hopLinks <pageUrl> <query>');
  }
  const { origin, projectName } = parsePageUrl(url);
  const [data, userMap] = await Promise.all([
    fetchRelatedPagesWithRelations(url, query),
    fetchUserMap(origin, projectName)
  ]);
  for (const page of (data as { links1hop?: unknown[] }).links1hop ?? []) {
    enrichPageUsers(page as Record<string, unknown>, userMap);
    enrichTimestampsOf(page as Record<string, unknown>);
  }
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
};
