import { parsePageUrl } from '../lib/parseUrl.ts';
import { requestJson } from '../lib/request.ts';
import { resolveUserCredential } from '../lib/settings.ts';

export const submitEditSummary =
  'previewEditで取得したpreviewIdを使ってページ編集を確定する';

export const submitEditHelp = `submitEdit - previewEditで取得したpreviewIdを使ってページ編集を確定する

Usage:
  cosense submitEdit <pageUrl> <previewId>

引数:
  <pageUrl>    編集対象ページのURL（projectName だけが使われる）
  <previewId>  previewEdit の戻り値の previewId

戻り値（plain text）:
  commitId: <生成されたcommitのID>
  title:    <実際に書き込まれたpage title（サーバーが auto-suffix した場合はそれが反映）>
  url:      <pageUrl 引数そのまま>

注意:
  preview は previewId だけで対象 page を特定する。 pageUrl の title 部分は projectName
  抽出のためだけに使われ、 preview の対象 page との一致は server 側で検証されない。
  出力の title と pageUrl が異なる場合は、 別 preview の id を渡している可能性がある。

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

ワークフロー:
  previewIdは1回しか使えない (consume-on-submit)。submitに失敗したら previewEdit から
  やり直す。previewIdは5分でexpireするので submit は迅速に。
`;

interface SubmitResponse {
  commitId: string;
  page: { title?: string } | null;
}

export const submitEdit = async (args: string[]): Promise<void> => {
  const [url, previewId] = args;
  if (!url || !previewId) {
    throw new Error('Usage: cosense submitEdit <pageUrl> <previewId>');
  }

  const { origin, projectName } = parsePageUrl(url);
  const apiUrl = `${origin}/api/pages/v2/${projectName}/page-edit-for-ai/submit`;
  // 書き込み系 API は PAT 限定 (Service Account 拒否) なので、PAT を直接解決する
  const credential = resolveUserCredential(origin);
  const response = (await requestJson(apiUrl, {
    credential,
    method: 'POST',
    body: { previewId }
  })) as SubmitResponse;

  const title = response.page?.title ?? '';
  process.stdout.write(
    `commitId: ${response.commitId}\ntitle:    ${title}\nurl:      ${url}\n`
  );
};
