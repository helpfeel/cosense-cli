import {
  encodeTitleForReadableLink,
  encodeTitleForUrl
} from '../lib/encodeTitle.ts';
import { formatTimestamp } from '../lib/formatTimestamp.ts';
import { parseProjectUrlStrict } from '../lib/parseUrl.ts';
import { requestJson } from '../lib/request.ts';
import {
  fetchUserMap,
  serviceAccountSuffix,
  type UserMap
} from '../lib/resolveUsers.ts';
import { resolveCredential, type Credential } from '../lib/settings.ts';

export const browsePageChangesSummary =
  'ページの最近の編集履歴(commit)をpageId起点で取得し、誰がいつ何をどう変えたかを自然言語で説明する。タイトル変更(リネーム)も検出する';

export const browsePageChangesHelp = `browsePageChanges - ページの最近の編集履歴(commit)をpageId起点で取得し自然言語で説明する

Usage:
  cosense browsePageChanges <projectUrl> <pageId> [--since <commitId> | [--before <commitId>] [--all]]

引数:
  <projectUrl>        プロジェクトのURL（例: https://scrapbox.io/shokai）
  <pageId>            ページの不変ID。browsePage / readPage の出力に含まれる
  --since <commitId>  指定した commitId より後の変更だけを対象にする（カーソル）。
                      browsePage / readPage 出力の commitId を控えておき、それを渡すと
                      「前回読んだ後に何が変わったか」だけを取得できる。
  --before <commitId> 指定した commitId より前の変更を、新しい方から最大100件対象にする。
                      前回の出力の「さらに前の変更を読むコマンド」をそのまま実行すると続きを読める。
  --all               保持中の全履歴を対象にする。履歴の長いページでは要求が何回にも分かれる。
                      --before と併用すると、その commitId より前の全履歴になる。
  どれも省略すると、最新の変更を新しい方から最大100件対象にする。
  --since は --before / --all と併用できない。

なぜpageId起点か:
  ページタイトルはURLになるため、共同編集者がタイトルを変更すると旧タイトルでは読めなくなる。
  ページの不変IDである pageId から編集履歴を辿れば、リネームされても変更を追える。

出力形式（Markdown plain text。JSONではない）:
  # ページ変更履歴
    pageId / 範囲 / commit数 / title change（範囲内の最後の変更後タイトル、無ければ なし）
    範囲外のタイトル変更は検出しないので、無しでもリネーム済みの事がある。
    範囲が最新の変更を含む時（--before 無し）は、タイトルが変わっていれば新URLと新Readable linkも出力する。
    --before 付きの title change は当時のタイトルで、現在のタイトルとは限らないのでURLは出さない。
    既定と --before（--all 無し）で範囲より前にも変更がある時は「さらに前の変更を読むコマンド」に、続きを読む完全なコマンドを示す
  ## 変更
    時系列の変更イベントを「<日時>\t<誰>が<何を>」の形（TAB区切り）で列挙する。
    同一行への連続した編集は1件にまとめ、変更前→最終のテキストを示す。
    本文編集に伴う派生メタデータ（links / icons / linesCount 等）は出力しない。
`;

interface CommitLine {
  id?: string;
  text?: string;
  origText?: string;
}

interface Change {
  title?: string;
  _insert?: string;
  _update?: string;
  _delete?: string;
  lines?: CommitLine;
}

interface Commit {
  id?: string;
  parentId?: string | null;
  changes?: Change[];
  userId?: string;
  created?: number;
}

interface CommitsResponse {
  commits?: Commit[];
  hasMore?: boolean;
}

interface ParsedArgs {
  projectUrl: string;
  pageId: string;
  since: string | undefined;
  before: string | undefined;
  all: boolean;
}

const parseArgs = (args: string[]): ParsedArgs => {
  const usage =
    'Usage: cosense browsePageChanges <projectUrl> <pageId> [--since <commitId> | [--before <commitId>] [--all]]';
  let since: string | undefined;
  let before: string | undefined;
  let all = false;
  const positional: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] as string;
    if (arg === '--since' || arg === '--before') {
      const value = args[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`${arg} requires a commitId\n${usage}`);
      }
      if (arg === '--since') {
        since = value;
      } else {
        before = value;
      }
      i += 1;
    } else if (arg === '--all') {
      all = true;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}\n${usage}`);
    } else {
      positional.push(arg);
    }
  }
  if (positional.length !== 2) {
    throw new Error(usage);
  }
  if (since !== undefined && (before !== undefined || all)) {
    throw new Error(`--since cannot be used with --before or --all\n${usage}`);
  }
  return {
    projectUrl: positional[0] as string,
    pageId: positional[1] as string,
    since,
    before,
    all
  };
};

const resolveUserName = (
  userId: string | undefined,
  userMap: UserMap
): string => {
  if (!userId) return '不明なユーザー';
  const info = userMap.get(userId);
  if (!info) return userId;
  const base = info.displayName ?? info.name ?? userId;
  return `${base}${serviceAccountSuffix(info)}`;
};

const quote = (text: string | undefined): string => `「${text ?? ''}」`;

// 1回の応答は件数と大きさで打ち切られ、続きがある時はhasMoreが真になる
// headより後のcommitを古い順に、headを最後のcommitに付け替えて全部取る
const fetchCommitsAfter = async (
  apiUrl: string,
  since: string,
  credential: Credential | undefined
): Promise<Commit[]> => {
  const commits: Commit[] = [];
  let head = since;
  let continuing = false;
  const requestedHeads = new Set<string>([since]);
  while (true) {
    const url = `${apiUrl}?head=${encodeURIComponent(head)}`;
    const data = (await requestJson(url, { credential })) as CommitsResponse;
    const batch = data.commits ?? [];
    const first = batch[0];
    // 続きが空だと、取れた分を完全な結果として出してしまうので止める。hasMoreは次の要求が空でない事まで保証しない
    if (continuing && !first) {
      throw new Error(`no commits follow head "${head}"`);
    }
    // headに続かない応答を辿ると、同じ応答を取り続けて終わらないので止める
    if (first && first.parentId !== head) {
      throw new Error(`commits do not follow head "${head}"`);
    }
    // spreadで足すと、1回の応答が大きい時に引数の上限を超える
    for (const commit of batch) commits.push(commit);
    if (!data.hasMore) return commits;
    const next = batch.at(-1)?.id;
    if (!next) {
      throw new Error('hasMore is true but the last commit has no id');
    }
    // 親子が循環した応答はparentIdの確認を通るので、同じheadを2度要求しない事で止める
    if (requestedHeads.has(next)) {
      throw new Error(`commit "${next}" appears again as head`);
    }
    requestedHeads.add(next);
    head = next;
    continuing = true;
  }
};

// 最新のcommit(beforeがあればその親)から親を辿った新しい順の応答を、allなら全部、でなければ1回分だけ取る
// olderCommitIdは、取った範囲より前に変更が残っている時の、続きを取るbefore
const fetchCommitsBefore = async (
  apiUrl: string,
  { before, all }: { before: string | undefined; all: boolean },
  credential: Credential | undefined
): Promise<{ commits: Commit[]; olderCommitId: string | undefined }> => {
  const commits: Commit[] = [];
  let cursor = before;
  // 前の応答の最後のcommitの親。続きの応答の先頭はこれでなければならない
  let expectedFirstId: string | null | undefined;
  const requestedCursors = new Set<string>(before ? [before] : []);
  while (true) {
    const url = cursor
      ? `${apiUrl}?before=${encodeURIComponent(cursor)}`
      : apiUrl;
    const data = (await requestJson(url, { credential })) as CommitsResponse;
    const batch = data.commits ?? [];
    const first = batch[0];
    // 古いserverはhead無しの応答を古い順に返す。隣り合う2件の親子の向きで見分け、古い100件を最新として出さない
    const second = batch[1];
    if (first && second && second.parentId === first.id) {
      throw new Error(
        'the server returned commits from the oldest. This version of cosense-cli needs a server that returns them from the latest'
      );
    }
    if (expectedFirstId !== undefined) {
      if (!first) {
        throw new Error(`no commits precede "${cursor}"`);
      }
      if (first.id !== expectedFirstId) {
        throw new Error(`commits do not precede "${cursor}"`);
      }
    }
    for (const commit of batch) commits.push(commit);
    const last = batch.at(-1);
    if (!data.hasMore) return { commits, olderCommitId: undefined };
    if (!last?.id) {
      throw new Error('hasMore is true but the last commit has no id');
    }
    if (!all) return { commits, olderCommitId: last.id };
    if (requestedCursors.has(last.id)) {
      throw new Error(`commit "${last.id}" appears again as before`);
    }
    requestedCursors.add(last.id);
    cursor = last.id;
    expectedFirstId = last.parentId ?? null;
  }
};

// 時系列の変更イベント。同一行への連続updateは1件に畳む
type ChangeEvent =
  | { kind: 'title'; userIds: string[]; created?: number; title: string }
  | { kind: 'insert'; userIds: string[]; created?: number; text: string }
  | {
      kind: 'update';
      userIds: string[];
      created?: number;
      lineId: string;
      origText: string;
      text: string;
    }
  | { kind: 'delete'; userIds: string[]; created?: number; origText: string };

const buildEvents = (commits: Commit[]): ChangeEvent[] => {
  const events: ChangeEvent[] = [];
  for (const commit of commits) {
    const userId = commit.userId ?? '';
    const created = commit.created;
    for (const change of commit.changes ?? []) {
      if (typeof change.title === 'string') {
        events.push({
          kind: 'title',
          userIds: [userId],
          created,
          title: change.title
        });
      } else if (typeof change._insert === 'string') {
        events.push({
          kind: 'insert',
          userIds: [userId],
          created,
          text: change.lines?.text ?? ''
        });
      } else if (typeof change._update === 'string') {
        const lineId = change._update;
        const last = events[events.length - 1];
        // 同一行への連続したupdateを畳む。origTextは最初の値を保ち、textを最新で上書き
        if (last && last.kind === 'update' && last.lineId === lineId) {
          last.text = change.lines?.text ?? '';
          last.created = created;
          if (userId && !last.userIds.includes(userId)) {
            last.userIds.push(userId);
          }
        } else {
          events.push({
            kind: 'update',
            userIds: [userId],
            created,
            lineId,
            origText: change.lines?.origText ?? '',
            text: change.lines?.text ?? ''
          });
        }
      } else if (typeof change._delete === 'string') {
        events.push({
          kind: 'delete',
          userIds: [userId],
          created,
          origText: change.lines?.origText ?? ''
        });
      }
      // links / icons / projectLinks / descriptions / linesCount / charsCount /
      // helpfeels / infobox* などは本文編集に伴う派生メタなので無視する
    }
  }
  return events;
};

const renderEvent = (event: ChangeEvent, userMap: UserMap): string => {
  const who = event.userIds.map(id => resolveUserName(id, userMap)).join('、');
  const when = formatTimestamp(event.created);
  const prefix = when ? `${when}\t` : '';
  switch (event.kind) {
    case 'title':
      return `${prefix}${who}がタイトルを${quote(event.title)}に変更`;
    case 'insert':
      return `${prefix}${who}が行を追加 ${quote(event.text)}`;
    case 'update':
      return `${prefix}${who}が行を編集 ${quote(event.origText)}→${quote(event.text)}`;
    case 'delete':
      return `${prefix}${who}が行を削除 ${quote(event.origText)}`;
  }
};

const fetchCommits = async (
  apiUrl: string,
  { since, before, all }: Pick<ParsedArgs, 'since' | 'before' | 'all'>,
  credential: Credential | undefined
): Promise<{ commits: Commit[]; olderCommitId: string | undefined }> => {
  if (since !== undefined) {
    const commits = await fetchCommitsAfter(apiUrl, since, credential);
    return { commits, olderCommitId: undefined };
  }
  const { commits, olderCommitId } = await fetchCommitsBefore(
    apiUrl,
    { before, all },
    credential
  );
  // 新しい順の応答を時系列に戻す。同一行への連続updateの畳み方が順序に依存する
  commits.reverse();
  return { commits, olderCommitId };
};

const describeRange = (
  { since, before, all }: Pick<ParsedArgs, 'since' | 'before' | 'all'>,
  count: number
): string => {
  if (since !== undefined) return `commit ${since} より後`;
  if (all && before !== undefined) return `commit ${before} より前の全履歴`;
  if (all) return '全履歴';
  if (before !== undefined) return `commit ${before} より前 ${count}件`;
  return `最新 ${count}件`;
};

export const browsePageChanges = async (args: string[]): Promise<void> => {
  const { projectUrl, pageId, since, before, all } = parseArgs(args);
  const { origin, projectName } = parseProjectUrlStrict(projectUrl);

  const apiUrl = `${origin}/api/commits/${projectName}/${pageId}`;
  const credential = resolveCredential(origin, projectName);

  const [{ commits, olderCommitId }, userMap] = await Promise.all([
    fetchCommits(apiUrl, { since, before, all }, credential),
    fetchUserMap(origin, projectName)
  ]);

  const events = buildEvents(commits);

  const titleEvents = events.filter(e => e.kind === 'title');
  const latestTitle = titleEvents.at(-1)?.title;

  const sections: string[] = ['# ページ変更履歴'];

  const meta: string[] = [
    `- pageId: ${pageId}`,
    `- 範囲: ${describeRange({ since, before, all }, commits.length)}`,
    `- commit数: ${commits.length}`,
    `- title change: ${latestTitle !== undefined ? quote(latestTitle) : 'なし'}`
  ];
  if (olderCommitId !== undefined) {
    meta.push(
      `- さらに前の変更を読むコマンド: cosense browsePageChanges ${origin}/${projectName} ${pageId} --before ${olderCommitId}`
    );
  }
  // タイトルが変わっていればURLも変わっている。新URLを添える
  // --before 付きの範囲のタイトルは当時の物で、その後に変わっている事があるのでURLにしない
  if (latestTitle !== undefined && before === undefined) {
    const newUrl = `${origin}/${projectName}/${encodeTitleForUrl(latestTitle)}`;
    meta.push(`- 新URL: ${newUrl}`);
    const newReadableLink = `${origin}/${projectName}/${encodeTitleForReadableLink(latestTitle)}`;
    meta.push(`- 新Readable link: ${newReadableLink}`);
  }
  sections.push(meta.join('\n'));

  if (events.length === 0) {
    sections.push('## 変更\n\nこの範囲に説明できる変更はありません');
  } else {
    const lines = events.map(event => renderEvent(event, userMap));
    sections.push(`## 変更\n\n${lines.join('\n')}`);
  }

  process.stdout.write(`${sections.join('\n\n')}\n`);
};
