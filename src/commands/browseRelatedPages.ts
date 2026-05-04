import { fetchRelatedPages } from '../lib/relatedPages.ts';

export const browseRelatedPagesSummary =
  '1-hop+2-hopのタイトル一覧を眺める。単独のページだけを見ていては掴みきれない文脈が浮かび上がる';

export const browseRelatedPagesHelp = `browseRelatedPages - 1-hop+2-hopのタイトル一覧を眺める。単独のページだけを見ていては掴みきれない文脈が浮かび上がる

Usage:
  cosense browseRelatedPages <pageUrl>

引数:
  <pageUrl>  対象ページの完全なURL

出力:
  1-hop と 2-hop の関連ページを pageRank 降順で並べたタイトルの一覧（改行区切り）。
  他のコマンドと異なり、JSON ではなくプレーンテキストを出力する。

  同一プレフィックスのページはスタックとして折りたたむ:
    日記 2025-01-01
    日記 2025-01-02
    他、47件の日記を省略します
`;

const stackPattern =
  /^([^\d]{3,})\s*([\d\-./()<>{}（）月火水木金土日年春夏秋冬]+|\d+ - [a-zA-Z])$/;

const STACK_PREVIEW = 2;

interface Page {
  title: string;
  titleLc?: string;
  pageRank?: number;
}

function detectStackName(title: string): string | null {
  const match = stackPattern.exec(title);
  return match?.[1]?.trimEnd() ?? null;
}

type Group =
  | { type: 'page'; title: string }
  | { type: 'stack'; name: string; titles: string[] };

function buildGroups(pages: Page[]): Group[] {
  const groups: Group[] = [];
  const stackIndexByName = new Map<string, number>();

  for (const page of pages) {
    const stackName = detectStackName(page.title);
    if (stackName !== null) {
      const existingIdx = stackIndexByName.get(stackName);
      if (existingIdx !== undefined) {
        (groups[existingIdx] as Extract<Group, { type: 'stack' }>).titles.push(
          page.title
        );
      } else {
        stackIndexByName.set(stackName, groups.length);
        groups.push({ type: 'stack', name: stackName, titles: [page.title] });
      }
    } else {
      groups.push({ type: 'page', title: page.title });
    }
  }

  return groups;
}

function renderGroups(groups: Group[]): string {
  const lines: string[] = [];
  for (const group of groups) {
    if (group.type === 'page') {
      lines.push(group.title);
    } else {
      for (const title of group.titles.slice(0, STACK_PREVIEW)) {
        lines.push(title);
      }
      const remaining = group.titles.length - STACK_PREVIEW;
      if (remaining > 0) {
        lines.push(`他、${remaining}件の${group.name}を省略します`);
      }
    }
  }
  return lines.join('\n');
}

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

  const seenTitleLc = new Set<string>();
  const pages: Page[] = [];

  const toTitleLc = (title: string): string =>
    title.replace(/ /g, '_').toLowerCase();

  if (result1hop.status === 'fulfilled') {
    const data = result1hop.value as { links1hop?: Page[] };
    for (const page of data.links1hop ?? []) {
      const tlc = page.titleLc ?? toTitleLc(page.title);
      if (!seenTitleLc.has(tlc)) {
        seenTitleLc.add(tlc);
        pages.push(page);
      }
    }
  }

  if (result2hop.status === 'fulfilled') {
    const data = result2hop.value as { links2hop?: Page[] };
    for (const page of data.links2hop ?? []) {
      const tlc = page.titleLc ?? toTitleLc(page.title);
      if (!seenTitleLc.has(tlc)) {
        seenTitleLc.add(tlc);
        pages.push(page);
      }
    }
  }

  pages.sort((a, b) => (b.pageRank ?? 0) - (a.pageRank ?? 0));

  const output = renderGroups(buildGroups(pages));
  if (output) {
    process.stdout.write(`${output}\n`);
  }
};
