import {
  buildGroups,
  dedupAndSortByPageRank,
  type Page,
  renderGroups
} from '../lib/relatedPagesFormat.ts';
import { fetchRelatedPages } from '../lib/relatedPages.ts';

export const browseRelatedPagesSummary =
  '1-hop+2-hopの関連ページタイトル一覧をAIが読みやすい形式で出力する';

export const browseRelatedPagesHelp = `browseRelatedPages - 1-hop+2-hopの関連ページタイトル一覧をAIが読みやすい形式で出力する

Usage:
  cosense browseRelatedPages <pageUrl>

引数:
  <pageUrl>  対象ページの完全なURL

出力:
  1-hop と 2-hop の関連ページそれぞれを pageRank 降順で並べたタイトルの一覧。
  他のコマンドと異なり、JSON ではなく Markdown 形式で出力する。

  # Related Pages

  ## 1 hop link

  - タイトル
  - 日記 2025-01-01
    他、48件の日記を省略します

  ## 2 hop link

  - タイトル
`;

export const browseRelatedPages = async (args: string[]): Promise<void> => {
  if (args.length !== 1) {
    throw new Error('Usage: cosense browseRelatedPages <pageUrl>');
  }
  const [url] = args as [string];

  const [result1hop, result2hop] = await Promise.allSettled([
    fetchRelatedPages(url, 1),
    fetchRelatedPages(url, 2)
  ]);

  if (result1hop.status === 'rejected' && result2hop.status === 'rejected') {
    throw result1hop.reason;
  }

  // seen は 1-hop と 2-hop で共有して、 1-hop に出たページが 2-hop にも再掲されないようにする
  const seen = new Set<string>();
  const pages1hop =
    result1hop.status === 'fulfilled'
      ? dedupAndSortByPageRank(
          (result1hop.value as { links1hop?: Page[] }).links1hop,
          seen
        )
      : [];
  const pages2hop =
    result2hop.status === 'fulfilled'
      ? dedupAndSortByPageRank(
          (result2hop.value as { links2hop?: Page[] }).links2hop,
          seen
        )
      : [];

  const sections: string[] = [];
  if (pages1hop.length > 0) {
    sections.push(`## 1 hop link\n\n${renderGroups(buildGroups(pages1hop))}`);
  }
  if (pages2hop.length > 0) {
    sections.push(`## 2 hop link\n\n${renderGroups(buildGroups(pages2hop))}`);
  }
  if (sections.length > 0) {
    process.stdout.write(`# Related Pages\n\n${sections.join('\n\n')}\n`);
  }
};
