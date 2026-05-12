import { enrichTimestampsOf } from '../lib/enrichTimestamps.ts';
import { parsePageUrl } from '../lib/parseUrl.ts';
import { fetchRelatedPages } from '../lib/relatedPages.ts';
import { enrichPageUsers, fetchUserMap } from '../lib/resolveUsers.ts';

export const list2hopLinksSummary = '2-hop近傍を取得する';

export const list2hopLinksHelp = `list2hopLinks - 2-hop近傍を取得する

Usage:
  cosense list2hopLinks <pageUrl>

引数:
  <pageUrl>  対象ページの完全なURL

戻り値（top-levelの主なkey）:
  links2hop          Array<Link>  2-hop近傍のページ配列
  hiddenHeadwordsLc  string[]     非表示のヘッドワード
  pagination         object       ページネーション情報

各 Link の field:
  id, title, titleLc, image, descriptions, linksLc, linked, pageRank,
  infoboxDefinition, infoboxDisableLinks,
  created, updated, accessed, lastAccessed (string), charsCount,
  user (作成者 User), lastUpdateUser (最終更新者 User | null), users (更新者リスト Array<User>)

User の field（user / lastUpdateUser / users[] で共通）:
  id           string   Cosense内部のID
  name         string?  ログイン名（自己紹介ページのタイトルや、本文中のアイコン記法で使われる）
  displayName  string?  表示名
  email        string?  メールアドレス

注意:
  - 直接の1-hop近傍は含まれない
  - list1hopLinks と異なり、relation field は付与されない
`;

export const list2hopLinks = async (args: string[]): Promise<void> => {
  if (args.length !== 1) {
    throw new Error('Usage: cosense list2hopLinks <pageUrl>');
  }
  const [url] = args as [string];
  const { origin, projectName } = parsePageUrl(url);
  const [data, userMap] = await Promise.all([
    fetchRelatedPages(url, 2),
    fetchUserMap(origin, projectName)
  ]);
  for (const page of (data as { links2hop?: unknown[] }).links2hop ?? []) {
    enrichPageUsers(page as Record<string, unknown>, userMap);
    enrichTimestampsOf(page as Record<string, unknown>);
  }
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
};
