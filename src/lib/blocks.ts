import { encodePathSegment, encodeTitleForUrl } from './encodeTitle.ts';
import type { BlockKind } from './parseUrl.ts';

export interface BlockFile {
  kind: BlockKind;
  name: string;
  blockCount: number;
  url: string;
}

const countIndent = (text: string): number =>
  (text.match(/^\s*/) as RegExpMatchArray)[0].length;

// 開始行でなければnull、開始行だが配信されないブロックなら空文字列を返す
type DetectStart = (text: string) => string | null;

const detectCodeBlockStart: DetectStart = text => {
  // `code:Rakefile(rb)`の末尾の括弧は言語名で、ファイル名に含まれない
  const match =
    text.match(/^\s*code:(.+)\(([^()]+)\)$/) ?? text.match(/^\s*code:(.+)$/);
  if (!match) return null;
  const name = (match[1] as string).trim();
  // 言語名が決まらない`code:foo.`のような行は、コードブロックにならない
  const lang = match[2] ?? name.split('.').pop();
  return lang ? name : null;
};

const detectTableStart: DetectStart = text => {
  const match = text.match(/^\s*table:(.+)$/);
  if (!match) return null;
  // 名前が空白だけのテーブルは、半角スペース1個の名前で配信される
  return (match[1] as string).trim() || ' ';
};

// 同じ名前のブロックは上から順に連結されて1つのファイルとして配信されるので、名前ごとにまとめる
const collectBlocks = (
  lines: string[],
  detectStart: DetectStart
): Map<string, number> => {
  const blockCounts = new Map<string, number>();
  // 1行目はページタイトルで、ブロックの開始行にならない
  for (let i = 1; i < lines.length; i += 1) {
    const name = detectStart(lines[i] as string);
    if (name === null) continue;
    const indent = countIndent(lines[i] as string);
    let end = i;
    while (
      end + 1 < lines.length &&
      countIndent(lines[end + 1] as string) > indent
    ) {
      end += 1;
    }
    // 中身が1行も無い名前は配信されず404になる
    if (name !== '' && end > i) {
      blockCounts.set(name, (blockCounts.get(name) ?? 0) + 1);
    }
    // ブロックの中の`code:`や`table:`の行は、同じ種類のブロックの開始行にならない
    i = end;
  }
  return blockCounts;
};

export const listBlockFiles = (
  lines: string[],
  page: { origin: string; projectName: string; title: string }
): BlockFile[] => {
  const pagePath = `${page.projectName}/${encodeTitleForUrl(page.title)}`;
  const files: BlockFile[] = [];
  // コードブロックとテーブルは互いに独立に検出する。コードブロックの中の`table:`行もテーブルとして配信される
  for (const [name, blockCount] of collectBlocks(lines, detectCodeBlockStart)) {
    files.push({
      kind: 'code',
      name,
      blockCount,
      // ファイル名の半角スペースは、タイトルと違って`_`に置換すると別の名前になる
      url: `${page.origin}/api/code/${pagePath}/${encodePathSegment(name)}`
    });
  }
  for (const [name, blockCount] of collectBlocks(lines, detectTableStart)) {
    files.push({
      kind: 'table',
      name,
      blockCount,
      url: `${page.origin}/api/table/${pagePath}/${encodePathSegment(name)}.csv`
    });
  }
  return files;
};

export const renderBlockFiles = (files: BlockFile[]): string | null => {
  if (files.length === 0) return null;
  const items = files.map(
    file =>
      `- ${file.kind}:${file.name} (${file.blockCount}ブロック)\n  ${file.url}`
  );
  return (
    '## コードブロック・テーブル\n\n' +
    '同じ名前のブロックは上から順に連結され、1つのファイルとして配信される。' +
    'downloadCodeBlockコマンドやdownloadTableコマンドで保存できる\n\n' +
    items.join('\n')
  );
};
