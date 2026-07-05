import { type Page, toTitleLc } from './relatedPagesFormat.ts';

interface InfoboxResultEntry {
  title?: string;
  infobox?: Record<string, string>;
}

export interface LiterateDatabaseSourcePage extends Page {
  linksLc?: string[];
  created?: number;
  updated?: number;
  infoboxResult?: InfoboxResultEntry[];
  infoboxDisableLinks?: string[];
}

interface Links1hopResponse {
  links1hop?: LiterateDatabaseSourcePage[];
  pagination?: { total?: number; hasNext?: boolean };
}

export interface DefinitionPage {
  title?: string;
  infoboxDefinition?: string[];
}

// 定義行はタブ区切りで、第1セルが列名。第2セル以降はInfoboxが値を抜き出す時の
// 指示文なので列にしない。第1セルがオプション宣言 (ExcludeTitleLine) の行も列にしない。
// 列名をtrimしないのは意図的: infoboxResultのkeyは未trimの第1セルで生成されるため、
// trimするとlookupが外れる（オプション宣言の判定だけがtrim込みで行われる）
const parseInfoboxFieldNames = (infoboxDefinition: string[]): string[] => {
  const fieldNames: string[] = [];
  for (const row of infoboxDefinition) {
    const firstCell = row.split('\t')[0] ?? '';
    if (firstCell.trim() === 'ExcludeTitleLine') continue;
    fieldNames.push(firstCell);
  }
  return fieldNames;
};

interface LiterateDatabaseRow {
  page: LiterateDatabaseSourcePage;
  infobox: Record<string, string>;
}

// 行選定はWeb UIの文芸的データベースと同じ:
// 定義ページにリンクしているページのうち、無効化されていないもの。
// 並びは通常の関連ページリストとソート基準を揃えたpageRank降順（Web UIとは異なる）
const buildRows = (
  definition: DefinitionPage,
  links1hop: LiterateDatabaseSourcePage[]
): LiterateDatabaseRow[] => {
  const definitionTitleLc = toTitleLc(definition.title ?? '');

  const rows: LiterateDatabaseRow[] = [];
  for (const page of links1hop) {
    const linksLc = page.linksLc ?? [];
    if (!linksLc.includes(definitionTitleLc)) continue;
    if (page.infoboxDisableLinks?.includes(definitionTitleLc)) continue;

    const infobox =
      page.infoboxResult?.find(
        entry => toTitleLc(entry.title ?? '') === definitionTitleLc
      )?.infobox ?? {};
    rows.push({ page, infobox });
  }

  rows.sort((a, b) => (b.page.pageRank ?? 0) - (a.page.pageRank ?? 0));
  return rows;
};

// TSVの1ページ=1行を守るため、セル内の改行・タブを置換する。
// セル値はAIが抽出した物なので、文字列以外が混ざっていても落ちないように文字列化する
const sanitizeCell = (value: unknown): string =>
  String(value ?? '')
    .replace(/\t/g, ' ')
    .replace(/\r\n|[\r\n]/g, ' / ');

const formatDateCell = (unixSec: number | undefined): string => {
  if (typeof unixSec !== 'number') return '';
  const d = new Date(unixSec * 1000);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};

// 対象がinfobox定義ページなら文芸的データベースのセクションを組み立てる。
// 定義ページでなければ null。表に載せたページは seen に積み、呼び出し側の
// 1 hop link 一覧に再掲されないようにする
export const renderLiterateDatabase = (
  definition: DefinitionPage,
  hopValue: unknown,
  seen: Set<string>
): string | null => {
  const infoboxDefinition = definition.infoboxDefinition ?? [];
  if (infoboxDefinition.length === 0) return null;

  const { links1hop = [], pagination } = (hopValue ?? {}) as Links1hopResponse;
  const fieldNames = parseInfoboxFieldNames(infoboxDefinition);
  const rows = buildRows(definition, links1hop);
  for (const { page } of rows) {
    seen.add(page.titleLc ?? toTitleLc(page.title));
  }

  const header = ['Page', 'Created', 'Updated', ...fieldNames].join('\t');
  const lines = rows.map(({ page, infobox }) =>
    [
      sanitizeCell(page.title),
      formatDateCell(page.created),
      formatDateCell(page.updated),
      ...fieldNames.map(field => sanitizeCell(infobox[field] ?? ''))
    ].join('\t')
  );

  // 見出しは通常ページの「1 hop link」に揃える。「文芸的データベース」を見出し単体で
  // 使うと、出力だけを読むAIが同名ページを探しに行ってしまう。ただしユーザーはこの表を
  // 「文芸的データベース」「Infoboxの表」「テーブル」等とも呼ぶので、指示と結びつくよう
  // 別名として括弧内に残す
  const parts = [
    '## 1 hop link（Infoboxの文芸的データベース、TSV形式のテーブル）',
    'Page/Created/Updated以外の列は、各ページの本文からInfoboxが抜き出した値',
    [header, ...lines].join('\n')
  ];
  if (rows.length === 0) {
    // ヘッダーだけの表は出力が途切れたようにも見えるので、0件である事を明示する
    parts.push('表に載るページが無いため、行は0件');
  }
  if (pagination?.hasNext) {
    parts.push(
      `注意: 関連ページが多いため、全${pagination.total}件のうち取得できた${links1hop.length}件から表を構成しています`
    );
  }
  return parts.join('\n\n');
};
