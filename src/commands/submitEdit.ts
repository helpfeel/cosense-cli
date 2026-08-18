import { encodeTitleForUrl } from '../lib/encodeTitle.ts';
import { parseProjectUrlStrict } from '../lib/parseUrl.ts';
import { requestJson } from '../lib/request.ts';
import { resolveCredential } from '../lib/settings.ts';

export const submitEditSummary =
  'previewEdit/previewDeleteで取得したpreviewIdを使ってページ編集・削除を確定する';

export const submitEditHelp = `submitEdit - previewEdit/previewDeleteで取得したpreviewIdを使ってページ編集・削除を確定する

Usage:
  cosense submitEdit <projectUrl> <previewId>

引数:
  <projectUrl>  プロジェクトのURL (例: https://scrapbox.io/shokai)。 末尾に余分なpathがあるとerror
  <previewId>   previewEdit または previewDelete の戻り値の previewId

戻り値（plain text）:
  commitId: <生成されたcommitのID>
  title:    <実際に書き込まれたpage title>
  url:      <作成または更新された page の URL>

  url はサーバーが返す title から再構築される。 同名ページが既に存在する場合、 サーバーは
  タイトルに auto-suffix を付ける (新規作成でも既存ページのタイトル変更でも起きる)。
  title/url にはその suffix が反映される。

  既存ページのタイトルが変わった編集では、続けて以下を出力する:
  titleChanged: "<変更前title>" -> "<変更後title>"
  新旧タイトルはそれぞれJSON string

  previewDelete の previewId を確定した時は、代わりに以下を出力する:
  commitId: <生成されたcommitのID>
  title:    <削除されたpage title>
  deleted:  true

HTTPエラー:
  HTTP 400  preview を生成した時と違う project の URL を渡している
  HTTP 401  認証なし
  HTTP 403  権限不足（PAT利用時、projectのmemberでない 等）
  HTTP 404  preview が見つからない / 期限切れ (5分) / 既にconsume済み / 他userのpreview
  HTTP 409 {"error":"NotFastForward","latest":...}
            preview生成後にページが更新された。最新stateを再取得して ops を作り直し、
            previewEdit からやり直す必要がある
  HTTP 409 {"error":"NotFastForward","latest":null}
            対象ページが既に存在しない。削除の確定でこれが返った場合、ページは別経路で
            削除済みであり、目的の状態は達成されている。リトライ不要
  HTTP 409 {"error":"DuplicateTitle"}
            preview→submit の間に他人が同名ページを作った (race condition)

previewId は1回限り (consume-on-submit)。submit 後・5分 expire 後・consume 済みは HTTP 404。
`;

interface SubmitResponse {
  commitId: string;
  page: { title?: string } | null;
  pageDeleted?: { title?: string };
  titleChanged?: { from?: string; to?: string };
}

export const submitEdit = async (args: string[]): Promise<void> => {
  if (args.length !== 2) {
    throw new Error('Usage: cosense submitEdit <projectUrl> <previewId>');
  }
  const [projectUrl, previewId] = args as [string, string];

  const { origin, projectName } = parseProjectUrlStrict(projectUrl);
  const apiUrl = `${origin}/api/pages/v2/${projectName}/page-edit-for-ai/submit`;
  // projectに紐づくService Accountがあればそれを、無ければPATを使う（読み取りと同じ）
  const credential = resolveCredential(origin, projectName);
  const response = (await requestJson(apiUrl, {
    credential,
    method: 'POST',
    body: { previewId }
  })) as SubmitResponse;

  // pageDeletedはページ削除commitの確定時に返る。削除されたページにURLは無い
  const pageDeleted = response.pageDeleted;
  if (pageDeleted) {
    process.stdout.write(
      `commitId: ${response.commitId}\ntitle:    ${pageDeleted.title ?? ''}\ndeleted:  true\n`
    );
    return;
  }

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

  // titleChangedはサーバーが対応している場合のみ返る
  const titleChanged = response.titleChanged;
  if (
    typeof titleChanged?.from === 'string' &&
    typeof titleChanged.to === 'string'
  ) {
    // タイトルには " や -> が含まれうるので、境界が一意に読めるようJSON stringで出力する
    process.stdout.write(
      `titleChanged: ${JSON.stringify(titleChanged.from)} -> ${JSON.stringify(
        titleChanged.to
      )}\n`
    );
  }
};
