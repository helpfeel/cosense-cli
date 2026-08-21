import { enrichTimestampsOf } from '../lib/enrichTimestamps.ts';
import { parseProjectUrlStrict } from '../lib/parseUrl.ts';
import { requestJson } from '../lib/request.ts';
import { resolveCredential } from '../lib/settings.ts';

export const listPageSnapshotsSummary =
  'ページのsnapshot一覧(Page History)をpageId起点で取得する';

export const listPageSnapshotsHelp = `listPageSnapshots - ページのsnapshot一覧(Page History)をpageId起点で取得する

Usage:
  cosense listPageSnapshots <projectUrl> <pageId>

引数:
  <projectUrl>  プロジェクトのURL (例: https://scrapbox.io/shokai)。 末尾に余分なpathがあるとerror
  <pageId>      ページの不変ID。browsePage / readPage の出力に含まれる

戻り値（top-levelのkey）:
  pageId      string                   対象ページのID
  timestamps  Array<{ id, created }>   snapshotの一覧。新しい順、最新100件まで
    id        string                   snapshotのID。readPageSnapshot に渡す
    created   string                   snapshot時点のページ最終更新時刻

戻り値のJSON抜粋例:
{
  "pageId": "5803c5397ad353b0aee24341",
  "timestamps": [
    {
      "id": "5cef4052dd15ed00447c1405",
      "created": "2019-05-30T11:29+09:00 (7 years ago)"
    }
  ]
}

HTTPエラー:
  HTTP 401  認証なし
  HTTP 403  権限不足（projectのmemberでない 等）
  HTTP 404  pageId に対応するpageが存在しない / pageId が不正な形式
`;

interface ListPageSnapshotsData {
  timestamps?: { id?: string; created?: number | string }[];
}

export const listPageSnapshots = async (args: string[]): Promise<void> => {
  if (args.length !== 2) {
    throw new Error('Usage: cosense listPageSnapshots <projectUrl> <pageId>');
  }
  const [projectUrl, pageId] = args as [string, string];

  const { origin, projectName } = parseProjectUrlStrict(projectUrl);
  const credential = resolveCredential(origin, projectName);

  // APIはx-following-idレスポンスヘッダで100件ずつページングするが、最新100件のみ返し追跡しない
  const apiUrl = `${origin}/api/page-snapshots/${projectName}/${pageId}`;
  const data = (await requestJson(apiUrl, {
    credential
  })) as ListPageSnapshotsData;

  for (const timestamp of data.timestamps ?? []) {
    enrichTimestampsOf(timestamp as Record<string, unknown>, ['created']);
  }

  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
};
