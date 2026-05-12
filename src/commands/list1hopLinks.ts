import { fetchRelatedPagesWithRelations } from '../lib/annotateRelations.ts';
import { enrichTimestampsOf } from '../lib/enrichTimestamps.ts';
import { parsePageUrl } from '../lib/parseUrl.ts';
import { enrichPageUsers, fetchUserMap } from '../lib/resolveUsers.ts';

export const list1hopLinksSummary = '1-hop近傍を取得する';

export const list1hopLinksHelp = `list1hopLinks - 1-hop近傍を取得する

Usage:
  cosense list1hopLinks <pageUrl>

引数:
  <pageUrl>  対象ページの完全なURL

戻り値（top-levelの主なkey）:
  links1hop            Array<Link>  1-hop近傍のページ配列
  charsCount           number       対象ページの文字数
  hasBackLinksOrIcons  boolean      被リンク・アイコン参照があるか
  kcsControlTagsLc     string[]     制御タグ
  pagination           object       ページネーション情報

各 Link の field:
  id, title, titleLc, image, descriptions(冒頭数行),
  linksLc(リンク記法のtitleLc配列), linked(被リンク数), pageRank,
  infoboxDefinition, infoboxDisableLinks,
  created, updated, accessed, lastAccessed (string), charsCount,
  user (作成者 User), lastUpdateUser (最終更新者 User | null), users (更新者リスト Array<User>),
  relation 'outgoing' | 'incoming' | 'bidirectional'
    outgoing      対象ページが参照しているページ（正リンク）
    incoming      対象ページを参照しているページ（逆リンク）
    bidirectional 双方向リンク

User の field（user / lastUpdateUser / users[] で共通）:
  id           string   Cosense内部のID
  name         string?  ログイン名（自己紹介ページのタイトルや、本文中のアイコン記法で使われる）
  displayName  string?  表示名
  email        string?  メールアドレス

戻り値のJSON抜粋例:
{
  "links1hop": [
    {
      "id": "...", "title": "...", "linked": 4, "pageRank": 14,
      "descriptions": ["..."], "linksLc": ["..."], "relation": "outgoing"
    }
  ]
}
`;

export const list1hopLinks = async (args: string[]): Promise<void> => {
  if (args.length !== 1) {
    throw new Error('Usage: cosense list1hopLinks <pageUrl>');
  }
  const [url] = args as [string];
  const { origin, projectName } = parsePageUrl(url);
  const [data, userMap] = await Promise.all([
    fetchRelatedPagesWithRelations(url),
    fetchUserMap(origin, projectName)
  ]);
  for (const page of (data as { links1hop?: unknown[] }).links1hop ?? []) {
    enrichPageUsers(page as Record<string, unknown>, userMap);
    enrichTimestampsOf(page as Record<string, unknown>);
  }
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
};
