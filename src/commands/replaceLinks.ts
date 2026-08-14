import { parseProjectUrlStrict } from '../lib/parseUrl.ts';
import { requestJson } from '../lib/request.ts';
import { resolveCredential } from '../lib/settings.ts';

export const replaceLinksSummary =
  '旧タイトルへのリンク記法を新しいタイトルに一括置換する';

export const replaceLinksHelp = `replaceLinks - 旧タイトルへのリンク記法を新しいタイトルに一括置換する

Usage:
  cosense replaceLinks <projectUrl> <oldTitle> <newTitle>

引数:
  <projectUrl>  プロジェクトのURL (例: https://scrapbox.io/shokai)。 末尾に余分なpathがあるとerror
  <oldTitle>    置換前のページタイトル
  <newTitle>    置換後のページタイトル

project内のページを走査し、 <oldTitle> を指すリンク記法 \`[title]\`・hashtag \`#title\`・
アイコン記法 \`[title.icon]\` を <newTitle> に書き換える。 タイトルの一致は大文字小文字と
空白/アンダースコアの違いを無視する。 他projectを指す \`[/project/title]\` は対象外。
リンク記法になっていない平文、 タイトル行、 code block、 CLI記法、 Helpfeel記法の行は書き換えない。

ページ自体のタイトルは変わらない。 タイトルの変更は previewEdit / submitEdit で行う。

戻り値（plain text）:
  更新したページ数を伝えるmessage (例: "3 pages have been successfully updated!")

HTTPエラー:
  HTTP 400  <oldTitle> と <newTitle> が同じ / どちらかが空 / <newTitle> がリンク記法として成立しない
  HTTP 401  認証なし
  HTTP 403  権限不足（PAT利用時、projectのmemberでない 等）
  HTTP 500  一部のページの更新に失敗した。 同じ引数で再実行できる。 置換済みのリンクが
            別の文字列へ再置換される事はない
`;

interface ReplaceLinksResponse {
  message: string;
}

export const replaceLinks = async (args: string[]): Promise<void> => {
  if (args.length !== 3) {
    throw new Error(
      'Usage: cosense replaceLinks <projectUrl> <oldTitle> <newTitle>'
    );
  }
  const [projectUrl, oldTitle, newTitle] = args as [string, string, string];

  const { origin, projectName } = parseProjectUrlStrict(projectUrl);
  const apiUrl = `${origin}/api/pages/${projectName}/replace/links`;
  // projectに紐づくService Accountがあればそれを、無ければPATを使う（読み取りと同じ）
  const credential = resolveCredential(origin, projectName);
  const response = (await requestJson(apiUrl, {
    credential,
    method: 'POST',
    body: { from: oldTitle, to: newTitle }
  })) as ReplaceLinksResponse;

  process.stdout.write(`${response.message}\n`);
};
