import { parseProjectUrlStrict } from '../lib/parseUrl.ts';
import { requestJson } from '../lib/request.ts';
import { resolveCredential } from '../lib/settings.ts';

export const previewDeleteSummary =
  'ページ削除をdry-runしてpreviewIdを取得する';

export const previewDeleteHelp = `previewDelete - ページ削除をdry-runしてpreviewIdを取得する

Usage:
  cosense previewDelete <projectUrl> <pageId>

引数:
  <projectUrl>  プロジェクトのURL (例: https://scrapbox.io/shokai)。 末尾に余分なpathがあるとerror
  <pageId>      削除対象ページのID。 readPage 出力の top-level "id" field から取得する

戻り値（plain text）:
  previewId / expireAt / status (delete) / project / title / commitId のヘッダー +
  削除されるpage全体。
  commitId は preview を作った時点の削除対象ページの最新コミット。
  preview は dry-run なのでこの段階では削除されない。
  previewId を submitEdit に渡すと削除が確定する。5分で expire する。

HTTPエラー:
  HTTP 401  認証なし
  HTTP 403  権限不足（PAT利用時、projectのmemberでない 等）
  HTTP 404  pageId に対応するpageが存在しない / pageId が不正な形式
`;

interface PagePreview {
  title?: string;
  commitId?: string;
  lines?: { id: string; text: string }[];
}

interface PreviewResponse {
  previewId: string;
  expireAt: string;
  pagePreview: PagePreview | null;
  pageDelete?: boolean;
}

export const previewDelete = async (args: string[]): Promise<void> => {
  if (args.length !== 2) {
    throw new Error('Usage: cosense previewDelete <projectUrl> <pageId>');
  }
  const [projectUrl, pageId] = args as [string, string];

  const { origin, projectName } = parseProjectUrlStrict(projectUrl);
  // projectに紐づくService Accountがあればそれを、無ければPATを使う（読み取りと同じ）
  const credential = resolveCredential(origin, projectName);

  const apiUrl = `${origin}/api/pages/v2/${projectName}/page-edit-for-ai/preview`;
  const response = (await requestJson(apiUrl, {
    credential,
    method: 'POST',
    body: { pageId, changes: [{ deleted: true }] }
  })) as PreviewResponse;

  // 削除は破壊的操作なので、サーバーが削除previewとして受理した事を確認してから表示する
  if (response.pageDelete !== true) {
    throw new Error(
      'server did not mark this preview as a page deletion. Do not submit the previewId.'
    );
  }

  const lines: string[] = [];
  lines.push(`previewId: ${response.previewId}`);
  lines.push(`expireAt:  ${response.expireAt}`);
  lines.push('status:    delete');
  lines.push(`project:   ${projectName}`);
  lines.push(`title:     ${response.pagePreview?.title ?? ''}`);
  lines.push(`commitId:  ${response.pagePreview?.commitId ?? ''}`);
  lines.push('');
  lines.push('page (will be deleted):');
  for (const line of response.pagePreview?.lines ?? []) {
    lines.push(`  ${line.text}`);
  }
  process.stdout.write(`${lines.join('\n')}\n`);
};
