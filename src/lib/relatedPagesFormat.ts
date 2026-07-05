export interface Page {
  title: string;
  titleLc?: string;
  pageRank?: number;
}

export const STACK_PREVIEW = 1;

const stackPattern =
  /^([^\d]{3,})\s*([\d\-./()<>{}（）月火水木金土日年春夏秋冬]+|\d+ - [a-zA-Z])$/;

export const detectStackName = (title: string): string | null =>
  stackPattern.exec(title)?.[1] ?? null;

export type Group =
  | { type: 'page'; title: string }
  | { type: 'stack'; name: string; titles: string[] };

export const buildGroups = (pages: Page[]): Group[] => {
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
};

export const toTitleLc = (title: string): string =>
  title.replace(/ /g, '_').toLowerCase();

export const dedupAndSortByPageRank = (
  pages: Page[] | undefined,
  seen: Set<string> = new Set<string>()
): Page[] => {
  const collected: Page[] = [];
  for (const page of pages ?? []) {
    const tlc = page.titleLc ?? toTitleLc(page.title);
    if (seen.has(tlc)) continue;
    seen.add(tlc);
    collected.push(page);
  }
  collected.sort((a, b) => (b.pageRank ?? 0) - (a.pageRank ?? 0));
  return collected;
};

export const renderGroups = (groups: Group[]): string => {
  const lines: string[] = [];
  for (const group of groups) {
    if (group.type === 'page') {
      lines.push(`- ${group.title}`);
    } else {
      for (const title of group.titles.slice(0, STACK_PREVIEW)) {
        lines.push(`- ${title}`);
      }
      const remaining = group.titles.length - STACK_PREVIEW;
      if (remaining > 0) {
        lines.push(`  他、${remaining}件の${group.name.trimEnd()}を省略します`);
      }
    }
  }
  return lines.join('\n');
};
