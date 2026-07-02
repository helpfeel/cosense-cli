import { fetchRelatedPagesWithRelations } from '../lib/annotateRelations.ts';
import { enrichTimestampsOf } from '../lib/enrichTimestamps.ts';
import { parsePageUrl } from '../lib/parseUrl.ts';
import { enrichPageUsers, fetchUserMap } from '../lib/resolveUsers.ts';

export const search1hopLinksSummary = '1-hop近傍を全文検索でフィルタする';

export const search1hopLinksHelp = `search1hopLinks - 1-hop近傍を全文検索でフィルタする

Usage:
  cosense search1hopLinks <pageUrl> <query> [--or]

引数:
  <pageUrl>  対象ページの完全なURL
  <query>    全文検索クエリ（必須。空文字は弾かれる）

オプション:
  --or  複数語のいずれかにマッチするページを返す（既定はAND）

例:
  cosense search1hopLinks https://scrapbox.io/shokai/カレー "うどん ラーメン" --or

戻り値（top-levelの主なkey）:
  links1hop  Array<Link>  query を本文に含む1-hop近傍ページ
  ほか list1hopLinks と同じ top-level key

各 Link の field（list1hopLinksに加えて）:
  search  検索ハイライト情報
`;

const parseArgs = (
  args: string[]
): { url: string; query: string; or: boolean } => {
  const usage = 'Usage: cosense search1hopLinks <pageUrl> <query> [--or]';
  let or = false;
  const positional: string[] = [];
  for (const arg of args) {
    if (arg === '--or') {
      or = true;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}\n${usage}`);
    } else {
      positional.push(arg);
    }
  }
  const [url, query] = positional;
  if (positional.length !== 2 || !url || !query || query.trim() === '') {
    throw new Error(usage);
  }
  return { url, query, or };
};

export const search1hopLinks = async (args: string[]): Promise<void> => {
  const { url, query, or } = parseArgs(args);
  const { origin, projectName } = parsePageUrl(url);
  const [data, userMap] = await Promise.all([
    fetchRelatedPagesWithRelations(url, query, or),
    fetchUserMap(origin, projectName)
  ]);
  for (const page of (data as { links1hop?: unknown[] }).links1hop ?? []) {
    enrichPageUsers(page as Record<string, unknown>, userMap);
    enrichTimestampsOf(page as Record<string, unknown>);
  }
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
};
