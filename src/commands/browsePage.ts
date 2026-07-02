import { enrichTimestampsOf } from '../lib/enrichTimestamps.ts';
import { parsePageUrl } from '../lib/parseUrl.ts';
import { fetchRelatedPages } from '../lib/relatedPages.ts';
import {
  buildGroups,
  dedupAndSortByPageRank,
  type Page as RelatedPage,
  renderGroups
} from '../lib/relatedPagesFormat.ts';
import { requestJson } from '../lib/request.ts';
import {
  enrichPageUsers,
  fetchUserMap,
  serviceAccountSuffix,
  type UserMap
} from '../lib/resolveUsers.ts';
import { resolveCredential } from '../lib/settings.ts';

export const browsePageSummary =
  '単一ページを読む。メタデータ+アイコン記法+テロメア+Infobox+本文をAIが読みやすい形式で出力する。行permalink (`#<lineId>`) 付きなら該当行をマークする';

export const browsePageHelp = `browsePage - 単一ページを読む。メタデータ+アイコン記法+テロメア+Infobox+本文をAIが読みやすい形式で出力する。行permalink (#<lineId>) 付きなら該当行をマークする

Usage:
  cosense browsePage <pageUrl>

引数:
  <pageUrl>  読むページの完全なURL（例: https://scrapbox.io/shokai/foo）
             URLに #<lineId> fragmentが付いていれば、本文のその行末に行permalinkマーカーを付与する

出力形式（Markdown plain text。JSONではない）:
  # <title>

  ## メタデータ
    タイトル / pageId / commitId / 作成日時 / 最終更新日時 / 最終アクセス日時 /
    被リンク数 / pageRank / views / snapshot / 行数 / 文字数 / 作成者 / 最終更新者 /
    関わったユーザー
    pageId はページの不変ID、commitId は閲覧時点の最新コミット。共同編集中に
    ページを見失ったら、これらを browsePageChanges に渡して変更（リネーム含む）を辿れる

  ## 人間のアイコン記法
    本文中の [name.icon] のうち、現メンバーまたは退去済みメンバー (memberSnapshots) の
    name に合致するものだけを [name.icon] の形で箇条書きする。
    一致が0件ならセクションごと省略

  ## テロメアのサマリー
    lines[] を最終更新者でグルーピングし、 displayName  更新期間 YYYY/M/D 〜 YYYY/M/D  N行更新
    の形式で行数降順に全員出力

  ## Infobox
    このページ本文から抜き出された Infobox を出力する。各 Infobox を ### <title> の
    見出しと  - キー: 値  の箇条書きで表す。値はCosense記法のまま。
    hallucination または truncated と判定された Infobox は除外する。
    0件の場合はセクションごと省略

  ## 本文
    各行の text を改行で結合。fragment 指定行のみ末尾に  #<lineId>  を付与

  -------------------- Related Pages --------------------
    本文と関連ページ一覧の境界を示す非Markdown区切り線。Cosenseの#hashtag記法と
    衝突しないようにMarkdown見出しを避ける。
  ## 1 hop link
    このページの 1-hop 近傍ページタイトル一覧。 1-hop が 0 件なら区切り線ごと省略

persistent: false の時:
  メタデータ・アイコン・テロメア・Infoboxは省略。 (このページはまだ作成されていません) と
  本文（テンプレート）と Related Pages を出力する

URLに #<lineId> fragmentが指定された時:
  タイトル直後に判定結果を1行出力する。
    - 24文字の小文字16進数フォーマットで本文に該当行があれば、行permalinkマーカーを本文中に付ける
    - フォーマット正、本文に該当行なし
    - フォーマット不正 (24文字の小文字16進数でない)
`;

interface PageLine {
  id?: string;
  text?: string;
  userId?: string;
  user?: { id?: string };
  updated?: number | string;
  created?: number | string;
}

interface UserRef {
  id?: string;
  name?: string;
  displayName?: string;
  isServiceAccount?: boolean;
  isServiceAccountDeleted?: boolean;
}

interface InfoboxResult {
  title?: string;
  infobox?: Record<string, string>;
  hallucination?: boolean;
  truncated?: boolean;
}

interface PageData {
  id?: string;
  commitId?: string;
  title?: string;
  persistent?: boolean;
  pageRank?: number;
  linked?: number;
  views?: number;
  linesCount?: number;
  charsCount?: number;
  snapshotCount?: number;
  snapshotCreated?: number | string;
  created?: number | string;
  updated?: number | string;
  accessed?: number | string;
  lastAccessed?: number | string;
  user?: UserRef | null;
  lastUpdateUser?: UserRef | null;
  users?: UserRef[];
  lines?: PageLine[];
  icons?: string[];
  infoboxResult?: InfoboxResult[];
}

const LINE_ID_PATTERN = /^[0-9a-f]{24}$/;

const extractFragment = (input: string): string | null => {
  const u = new URL(input);
  if (!u.hash) return null;
  const value = u.hash.slice(1);
  return value === '' ? null : value;
};

const formatUserDisplay = (u: UserRef | null | undefined): string | null => {
  if (!u) return null;
  const base =
    u.displayName && u.name
      ? `${u.displayName} (${u.name})`
      : (u.displayName ?? u.name ?? u.id ?? null);
  if (base === null) return null;
  return `${base}${serviceAccountSuffix(u)}`;
};

const formatDateYMD = (unixSec: number): string => {
  const d = new Date(unixSec * 1000);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

const normalizeIndent = (text: string): string =>
  text.replace(/^\s+/, m => '\t'.repeat(m.length));

interface TelomereEntry {
  userId: string;
  lineCount: number;
  minUpdated: number;
  maxUpdated: number;
}

const buildTelomere = (lines: PageLine[]): TelomereEntry[] => {
  const byUser = new Map<string, TelomereEntry>();
  for (const line of lines) {
    const uid = line.userId;
    const updated = line.updated;
    if (!uid || typeof updated !== 'number') continue;
    const entry = byUser.get(uid);
    if (entry) {
      entry.lineCount += 1;
      if (updated < entry.minUpdated) entry.minUpdated = updated;
      if (updated > entry.maxUpdated) entry.maxUpdated = updated;
    } else {
      byUser.set(uid, {
        userId: uid,
        lineCount: 1,
        minUpdated: updated,
        maxUpdated: updated
      });
    }
  }
  return [...byUser.values()].sort((a, b) => b.lineCount - a.lineCount);
};

const renderMetadata = (page: PageData): string => {
  const items: string[] = [];
  if (typeof page.title === 'string') items.push(`- タイトル: ${page.title}`);
  if (typeof page.id === 'string') items.push(`- pageId: ${page.id}`);
  if (typeof page.commitId === 'string') {
    items.push(`- commitId: ${page.commitId}`);
  }
  if (page.created) items.push(`- 作成日時: ${page.created}`);
  if (page.updated) items.push(`- 最終更新日時: ${page.updated}`);
  if (page.accessed) items.push(`- 最終アクセス日時: ${page.accessed}`);
  if (typeof page.linked === 'number')
    items.push(`- 被リンク数: ${page.linked}`);
  if (typeof page.pageRank === 'number') {
    items.push(`- pageRank: ${page.pageRank}`);
  }
  if (typeof page.views === 'number') items.push(`- views: ${page.views}`);
  if (typeof page.snapshotCount === 'number' && page.snapshotCount > 0) {
    const latest = page.snapshotCreated ? `、最新 ${page.snapshotCreated}` : '';
    items.push(`- snapshot: ${page.snapshotCount} 件${latest}`);
  }
  if (typeof page.linesCount === 'number') {
    items.push(`- 行数: ${page.linesCount}`);
  }
  if (typeof page.charsCount === 'number') {
    items.push(`- 文字数: ${page.charsCount}`);
  }
  const author = formatUserDisplay(page.user);
  if (author) items.push(`- 作成者: ${author}`);
  const lastUpdater = formatUserDisplay(page.lastUpdateUser);
  if (lastUpdater) items.push(`- 最終更新者: ${lastUpdater}`);
  if (page.users && page.users.length > 0) {
    items.push('- 関わったユーザー:');
    for (const u of page.users) {
      const f = formatUserDisplay(u);
      if (f) items.push(`  - ${f}`);
    }
  }
  return `## メタデータ\n\n${items.join('\n')}`;
};

const renderHumanIcons = (
  icons: string[] | undefined,
  userMap: UserMap
): string | null => {
  if (!icons || icons.length === 0) return null;
  const memberNames = new Set<string>();
  for (const info of userMap.values()) {
    if (info.name) memberNames.add(info.name);
  }
  const human = icons.filter(name => memberNames.has(name));
  if (human.length === 0) return null;
  return `## 人間のアイコン記法\n\n${human.map(name => `- [${name}.icon]`).join('\n')}`;
};

const renderTelomere = (
  entries: TelomereEntry[],
  userMap: UserMap
): string | null => {
  if (entries.length === 0) return null;
  const lines = entries.map(e => {
    const info = userMap.get(e.userId);
    const base = info?.displayName ?? info?.name ?? e.userId;
    const name = info ? `${base}${serviceAccountSuffix(info)}` : base;
    return `- ${name}\t更新期間 ${formatDateYMD(e.minUpdated)} 〜 ${formatDateYMD(e.maxUpdated)}\t${e.lineCount}行更新`;
  });
  return `## テロメアのサマリー\n\n${lines.join('\n')}`;
};

const renderInfobox = (results: InfoboxResult[] | undefined): string | null => {
  if (!results) return null;
  const blocks: string[] = [];
  for (const result of results) {
    // hallucination=AI補完の不確実値、truncated=抽出失敗で値が不完全。どちらも
    // 信頼できないので丸ごと除外する
    if (result.hallucination || result.truncated) continue;
    const rows = Object.entries(result.infobox ?? {}).map(
      ([key, value]) => `- ${key}: ${value}`
    );
    if (rows.length === 0) continue;
    blocks.push(`### ${result.title ?? ''}\n\n${rows.join('\n')}`);
  }
  if (blocks.length === 0) return null;
  return `## Infobox\n\n${blocks.join('\n\n')}`;
};

interface BodyRender {
  body: string;
  matchedFragment: boolean;
}

const renderBody = (lines: PageLine[], fragment: string | null): BodyRender => {
  let matchedFragment = false;
  const out: string[] = [];
  for (const line of lines) {
    const text = normalizeIndent(line.text ?? '');
    if (fragment && line.id === fragment) {
      matchedFragment = true;
      out.push(`${text}\t#${line.id}`);
    } else {
      out.push(text);
    }
  }
  return { body: out.join('\n'), matchedFragment };
};

const renderRelatedPages = (hopValue: unknown): string | null => {
  const links1hop = (hopValue as { links1hop?: RelatedPage[] }).links1hop;
  const pages = dedupAndSortByPageRank(links1hop);
  if (pages.length === 0) return null;
  return `-------------------- Related Pages --------------------\n\n## 1 hop link\n\n${renderGroups(buildGroups(pages))}`;
};

export const browsePage = async (args: string[]): Promise<void> => {
  if (args.length !== 1) {
    throw new Error('Usage: cosense browsePage <pageUrl>');
  }
  const [input] = args as [string];
  const fragment = extractFragment(input);
  const { origin, projectName, encodedTitle } = parsePageUrl(input);
  const apiUrl = `${origin}/api/pages/v2/${projectName}/${encodedTitle}`;
  const credential = resolveCredential(origin, projectName);

  // 必要なAPIのいずれかが失敗したら exit 1 で落とす。 graceful degradation
  // させると「アイコンが0件」「1-hopが0件」と区別がつかなくなり、AIに誤った
  // 文脈を渡してしまう
  const [page, userMap, hopValue] = await Promise.all([
    requestJson(apiUrl, { credential }) as Promise<PageData>,
    fetchUserMap(origin, projectName),
    fetchRelatedPages(input, 1)
  ]);

  const title = page.title ?? '';
  const persistent = page.persistent !== false;
  const sections: string[] = [`# ${title}`];

  if (!persistent) {
    sections.push('(このページはまだ作成されていません)');
    const { body } = renderBody(page.lines ?? [], null);
    sections.push(`## 本文（テンプレート）\n\n${body}`);
    const related = renderRelatedPages(hopValue);
    if (related) sections.push(related);
    process.stdout.write(`${sections.join('\n\n')}\n`);
    return;
  }

  // 本文を先にrenderしてfragment一致状況を取得し、タイトル直後の説明文に反映する
  const validFragment = fragment !== null && LINE_ID_PATTERN.test(fragment);
  const { body, matchedFragment } = renderBody(
    page.lines ?? [],
    validFragment ? fragment : null
  );
  if (fragment !== null) {
    if (!validFragment) {
      sections.push(`#${fragment} は行IDとしてフォーマットが正しくない`);
    } else if (matchedFragment) {
      sections.push(
        `指定された行ID #${fragment} に合致する行が存在する。本文のセクション内で示す`
      );
    } else {
      sections.push(
        `指定された行ID #${fragment} に合致する行は本文に存在しなかった`
      );
    }
  }

  // telomere は line.updated が unix秒のうちに集計する
  const telomere = buildTelomere(page.lines ?? []);

  enrichTimestampsOf(page as Record<string, unknown>, [
    'created',
    'updated',
    'accessed',
    'lastAccessed',
    'snapshotCreated'
  ]);
  enrichPageUsers(page, userMap);

  sections.push(renderMetadata(page));

  const iconsSection = renderHumanIcons(page.icons, userMap);
  if (iconsSection) sections.push(iconsSection);

  const telomereSection = renderTelomere(telomere, userMap);
  if (telomereSection) sections.push(telomereSection);

  const infoboxSection = renderInfobox(page.infoboxResult);
  if (infoboxSection) sections.push(infoboxSection);

  sections.push(`## 本文\n\n${body}`);

  const related = renderRelatedPages(hopValue);
  if (related) sections.push(related);

  process.stdout.write(`${sections.join('\n\n')}\n`);
};
