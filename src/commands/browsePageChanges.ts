import { encodeTitleForUrl } from '../lib/encodeTitle.ts';
import { formatTimestamp } from '../lib/formatTimestamp.ts';
import { parseProjectUrlStrict } from '../lib/parseUrl.ts';
import { requestJson } from '../lib/request.ts';
import { fetchUserMap, type UserMap } from '../lib/resolveUsers.ts';
import { resolveCredential } from '../lib/settings.ts';

export const browsePageChangesSummary =
  'ページの編集履歴(commit)をpageId起点で取得し、誰がいつ何をどう変えたかを自然言語で説明する。タイトル変更(リネーム)も検出する';

export const browsePageChangesHelp = `browsePageChanges - ページの編集履歴(commit)をpageId起点で取得し自然言語で説明する

Usage:
  cosense browsePageChanges <projectUrl> <pageId> [--since <commitId>]

引数:
  <projectUrl>       プロジェクトのURL（例: https://scrapbox.io/shokai）
  <pageId>           ページの不変ID。browsePage / readPage の出力に含まれる
  --since <commitId> 指定した commitId より後の変更だけを対象にする（カーソル）。
                     browsePage / readPage 出力の commitId を控えておき、それを渡すと
                     「前回読んだ後に何が変わったか」だけを取得できる。
                     省略すると全履歴を対象にする。

なぜpageId起点か:
  ページタイトルはURLになるため、共同編集者がタイトルを変更すると旧タイトルでは読めなくなる。
  ページの不変IDである pageId から編集履歴を辿れば、リネームされても変更を追える。

出力形式（Markdown plain text。JSONではない）:
  # ページ変更履歴
    pageId / 範囲（--since より後か全履歴か）/ commit数 / title change（変更後タイトル、無ければ なし）
    タイトルが変わっていた時のみ、新URLも出力する
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
  changes?: Change[];
  userId?: string;
  created?: number;
}

interface CommitsResponse {
  commits?: Commit[];
}

interface ParsedArgs {
  projectUrl: string;
  pageId: string;
  since: string | undefined;
}

const parseArgs = (args: string[]): ParsedArgs => {
  const usage =
    'Usage: cosense browsePageChanges <projectUrl> <pageId> [--since <commitId>]';
  let since: string | undefined;
  const positional: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] as string;
    if (arg === '--since') {
      const value = args[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`--since requires a commitId\n${usage}`);
      }
      since = value;
      i += 1;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}\n${usage}`);
    } else {
      positional.push(arg);
    }
  }
  if (positional.length !== 2) {
    throw new Error(usage);
  }
  return {
    projectUrl: positional[0] as string,
    pageId: positional[1] as string,
    since
  };
};

const resolveUserName = (
  userId: string | undefined,
  userMap: UserMap
): string => {
  if (!userId) return '不明なユーザー';
  const info = userMap.get(userId);
  return info?.displayName ?? info?.name ?? userId;
};

const quote = (text: string | undefined): string => `「${text ?? ''}」`;

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

export const browsePageChanges = async (args: string[]): Promise<void> => {
  const { projectUrl, pageId, since } = parseArgs(args);
  const { origin, projectName } = parseProjectUrlStrict(projectUrl);

  let apiUrl = `${origin}/api/commits/${projectName}/${pageId}`;
  if (since) {
    apiUrl += `?head=${encodeURIComponent(since)}`;
  }
  const credential = resolveCredential(origin, projectName);

  const [data, userMap] = await Promise.all([
    requestJson(apiUrl, { credential }) as Promise<CommitsResponse>,
    fetchUserMap(origin, projectName)
  ]);

  const commits = data.commits ?? [];
  const events = buildEvents(commits);

  const titleEvents = events.filter(e => e.kind === 'title');
  const latestTitle = titleEvents.at(-1)?.title;

  const sections: string[] = ['# ページ変更履歴'];

  const meta: string[] = [
    `- pageId: ${pageId}`,
    `- 範囲: ${since ? `commit ${since} より後` : '全履歴'}`,
    `- commit数: ${commits.length}`,
    `- title change: ${latestTitle !== undefined ? quote(latestTitle) : 'なし'}`
  ];
  // タイトルが変わっていればURLも変わっている。新URLを添える
  if (latestTitle !== undefined) {
    const newUrl = `${origin}/${projectName}/${encodeTitleForUrl(latestTitle)}`;
    meta.push(`- 新URL: ${newUrl}`);
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
