import { enrichTimestampsOf } from '../lib/enrichTimestamps.ts';
import { parseProjectUrlStrict } from '../lib/parseUrl.ts';
import { requestJson } from '../lib/request.ts';
import { enrichUser, fetchUserMap } from '../lib/resolveUsers.ts';
import { resolveCredential } from '../lib/settings.ts';

export const readPageSnapshotSummary =
  'snapshotのIDを指定してPage History上の過去の本文を読む';

export const readPageSnapshotHelp = `readPageSnapshot - snapshotのIDを指定してPage History上の過去の本文を読む

Usage:
  cosense readPageSnapshot <projectUrl> <pageId> <snapshotId>

引数:
  <projectUrl>  プロジェクトのURL (例: https://scrapbox.io/shokai)。 末尾に余分なpathがあるとerror
  <pageId>      ページの不変ID。browsePage / readPage の出力に含まれる
  <snapshotId>  snapshotのID。listPageSnapshots の timestamps[].id から取得する

戻り値（top-levelのkey）:
  page      object   現在のページのメタデータ。field構成は readPage のtop-levelから本文・リンク系
                     (lines / links / icons 等) を除いたもの。現在の本文は含まれない
  snapshot  object   snapshot時点のページ
    title     string       snapshot時点のページタイトル
    created   string       snapshot時点のページ最終更新時刻
    lines     Array<Line>  snapshot時点の本文。Line = { id, text, user, created, updated }

戻り値のJSON抜粋例:
{
  "page": {
    "id": "5803c5397ad353b0aee24341",
    "title": "page1",
    "commitId": "5cef401cfca37d0018dd9ead"
  },
  "snapshot": {
    "title": "page1",
    "created": "2019-05-30T11:29+09:00 (7 years ago)",
    "lines": [
      {
        "id": "5803c5397ad353b0aee24341",
        "text": "page1",
        "user": { "id": "5803c4bd7ad353b0aee24328", "name": "shokai" },
        "created": "2019-05-30T11:29+09:00 (7 years ago)",
        "updated": "2019-05-30T11:29+09:00 (7 years ago)"
      }
    ]
  }
}

絞り込み例（jqで欲しい部分だけ抜き出す）:
  snapshot時点の各行のテキストだけ:
    cosense readPageSnapshot <projectUrl> <pageId> <snapshotId> | jq -r '.snapshot.lines[].text'

HTTPエラー:
  HTTP 401  認証なし
  HTTP 403  権限不足（projectのmemberでない 等）
  HTTP 404  pageId に対応するpageが存在しない / snapshotId がこのページのsnapshotでない
  HTTP 422  snapshotId が不正な形式
`;

interface UserRef {
  id: string;
}

interface SnapshotLine {
  id?: string;
  text?: string;
  userId?: string;
  user?: UserRef;
  created?: number | string;
  updated?: number | string;
}

interface PageMetadata {
  user?: UserRef | null;
  lastUpdateUser?: UserRef | null;
  users?: UserRef[];
}

interface ReadPageSnapshotData {
  page?: PageMetadata;
  snapshot?: {
    created?: number | string;
    lines?: SnapshotLine[];
  };
}

export const readPageSnapshot = async (args: string[]): Promise<void> => {
  if (args.length !== 3) {
    throw new Error(
      'Usage: cosense readPageSnapshot <projectUrl> <pageId> <snapshotId>'
    );
  }
  const [projectUrl, pageId, snapshotId] = args as [string, string, string];

  const { origin, projectName } = parseProjectUrlStrict(projectUrl);
  const credential = resolveCredential(origin, projectName);

  const apiUrl = `${origin}/api/page-snapshots/${projectName}/${pageId}/${snapshotId}`;
  const data = (await requestJson(apiUrl, {
    credential
  })) as ReadPageSnapshotData;

  const userMap = await fetchUserMap(origin, projectName);
  const page = data.page;
  if (page) {
    enrichUser(page.user, userMap);
    enrichUser(page.lastUpdateUser, userMap);
    for (const editor of page.users ?? []) {
      enrichUser(editor, userMap);
    }
    enrichTimestampsOf(page as Record<string, unknown>, [
      'created',
      'updated',
      'accessed',
      'snapshotCreated',
      'lastAccessed'
    ]);
  }
  const snapshot = data.snapshot;
  if (snapshot) {
    for (const line of snapshot.lines ?? []) {
      const userId = line.userId;
      if (typeof userId === 'string' && userId !== '') {
        line.user = { id: userId };
        delete line.userId;
        enrichUser(line.user, userMap);
      }
      enrichTimestampsOf(line as Record<string, unknown>, [
        'created',
        'updated'
      ]);
    }
    enrichTimestampsOf(snapshot as Record<string, unknown>, ['created']);
  }

  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
};
