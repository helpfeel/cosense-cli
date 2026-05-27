import { encodeTitleForUrl } from '../lib/encodeTitle.ts';
import { parseProjectUrlStrict } from '../lib/parseUrl.ts';
import { requestJson } from '../lib/request.ts';
import { resolveUserCredential } from '../lib/settings.ts';

export const submitEditSummary =
  'previewEditで取得したpreviewIdを使ってページ編集を確定する';

export const submitEditHelp = `submitEdit - previewEditで取得したpreviewIdを使ってページ編集を確定する

Usage:
  cosense submitEdit <projectUrl> <previewId>

引数:
  <projectUrl>  プロジェクトのURL (例: https://scrapbox.io/shokai)。 末尾に余分なpathがあるとerror
  <previewId>   previewEdit の戻り値の previewId

戻り値（plain text）:
  commitId: <生成されたcommitのID>
  title:    <実際に書き込まれたpage title>
  url:      <作成または更新された page の URL>

  url はサーバーが返す title から再構築される。 新規作成時にサーバーが auto-suffix した場合
  (同名ページが既に存在する場合) は、 title/url にその suffix が反映される。

HTTPエラー:
  HTTP 400  preview を生成した時と違う project の URL を渡している
  HTTP 401  認証なし
  HTTP 403  非memberまたはService Account（書き込みはPAT限定）
  HTTP 404  preview が見つからない / 期限切れ (5分) / 既にconsume済み / 他userのpreview
  HTTP 409 {"error":"NotFastForward","latest":...}
            preview生成後にページが更新された。最新stateを再取得して ops を作り直し、
            previewEdit からやり直す必要がある
  HTTP 409 {"error":"DuplicateTitle"}
            preview→submit の間に他人が同名ページを作った (race condition)

previewId は1回限り (consume-on-submit)。submit 後・5分 expire 後・consume 済みは HTTP 404。
`;

interface SubmitResponse {
  commitId: string;
  page: { title?: string } | null;
}

export const submitEdit = async (args: string[]): Promise<void> => {
  if (args.length !== 2) {
    throw new Error('Usage: cosense submitEdit <projectUrl> <previewId>');
  }
  const [projectUrl, previewId] = args as [string, string];

  const { origin, projectName } = parseProjectUrlStrict(projectUrl);
  const apiUrl = `${origin}/api/pages/v2/${projectName}/page-edit-for-ai/submit`;
  // 書き込み系 API は PAT 限定 (Service Account 拒否) なので、PAT を直接解決する
  const credential = resolveUserCredential(origin);
  const response = (await requestJson(apiUrl, {
    credential,
    method: 'POST',
    body: { previewId }
  })) as SubmitResponse;

  const title = response.page?.title;
  if (typeof title !== 'string') {
    throw new Error(
      `submit response missing page field (commitId: ${response.commitId})`
    );
  }
  const url = `${origin}/${projectName}/${encodeTitleForUrl(title)}`;
  process.stdout.write(
    `commitId: ${response.commitId}\ntitle:    ${title}\nurl:      ${url}\n`
  );
};
