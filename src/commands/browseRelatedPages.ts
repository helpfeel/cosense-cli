import {
  buildGroups,
  dedupAndSortByPageRank,
  type Page,
  renderGroups
} from '../lib/relatedPagesFormat.ts';
import {
  type DefinitionPage,
  renderLiterateDatabase
} from '../lib/literateDatabase.ts';
import { fetchRelatedPages } from '../lib/relatedPages.ts';
import { parsePageUrl } from '../lib/parseUrl.ts';
import { requestJson } from '../lib/request.ts';
import { resolveCredential } from '../lib/settings.ts';

export const browseRelatedPagesSummary =
  '1-hop+2-hopの関連ページタイトル一覧をAIが読みやすい形式で出力する。infobox定義ページでは文芸的データベース(TSV表)を出力する';

export const browseRelatedPagesHelp = `browseRelatedPages - 1-hop+2-hopの関連ページタイトル一覧をAIが読みやすい形式で出力する。infobox定義ページでは文芸的データベース(TSV表)を出力する

Usage:
  cosense browseRelatedPages <pageUrl>

引数:
  <pageUrl>  対象ページの完全なURL

出力:
  1-hop と 2-hop の関連ページそれぞれを pageRank 降順で並べたタイトルの一覧。
  他のコマンドと異なり、JSON ではなく Markdown 形式で出力する。

  # Related Pages

  ## 1 hop link

  - タイトル
  - 日記 2025-01-01
    他、48件の日記を省略します

  ## 2 hop link

  - タイトル

対象がinfobox定義ページ（本文に table:infobox または table:cosense を宣言している）の時:
  Web UIと同様に、関連ページリストの先頭が文芸的データベース（TSV形式のテーブル）になる。
  行 = このページにリンクしているページ（pageRank 降順）。
  列 = Page / Created / Updated + 定義された項目。
  セル = 各ページの本文からInfoboxが抜き出した値（Cosense記法のまま。セル内の改行は「 / 」に置換）。
  表に載らなかった関連ページは、続く ## 1 hop link（表に載っていないページ） に出力する。

  # Related Pages

  ## 1 hop link（Infoboxの文芸的データベース、TSV形式のテーブル）

  Page/Created/Updated以外の列は、各ページの本文からInfoboxが抜き出した値

  Page	Created	Updated	材料	カテゴリ
  麻婆豆腐	2018-03-04	2026-07-05	[豆腐]、[挽き肉]	中華

  ## 1 hop link（表に載っていないページ）

  - 料理
`;

export const browseRelatedPages = async (args: string[]): Promise<void> => {
  if (args.length !== 1) {
    throw new Error('Usage: cosense browseRelatedPages <pageUrl>');
  }
  const [url] = args as [string];
  const { origin, projectName, encodedTitle } = parsePageUrl(url);
  const credential = resolveCredential(origin, projectName);

  // ページ本体はinfobox定義の取得にだけ使う。失敗しても従来のタイトル一覧に
  // フォールバックできるよう、関連ページの取得失敗とは区別する
  const [resultPage, result1hop, result2hop] = await Promise.allSettled([
    requestJson(`${origin}/api/pages/v2/${projectName}/${encodedTitle}`, {
      credential
    }) as Promise<DefinitionPage>,
    fetchRelatedPages(url, 1),
    fetchRelatedPages(url, 2)
  ]);

  if (result1hop.status === 'rejected' && result2hop.status === 'rejected') {
    throw result1hop.reason;
  }

  const sections: string[] = [];
  // seen は文芸的データベース・1-hop・2-hopで共有して、先に出たページを再掲しないようにする
  const seen = new Set<string>();

  let hasLiterateDatabase = false;
  if (resultPage.status === 'rejected') {
    // 非定義ページと区別が付かないまま黙って通常出力に落ちると、AIが不完全な
    // 出力を信じてしまうので、判定不能である事をstderrで知らせる
    process.stderr.write(
      'ページ情報の取得に失敗したため、infobox定義ページかどうか判定できません。文芸的データベースがあっても出力されません\n'
    );
  } else if (result1hop.status === 'fulfilled') {
    const literateDatabase = renderLiterateDatabase(
      resultPage.value,
      result1hop.value,
      seen
    );
    if (literateDatabase) {
      sections.push(literateDatabase);
      hasLiterateDatabase = true;
    }
  } else if ((resultPage.value.infoboxDefinition?.length ?? 0) > 0) {
    // infobox定義ページだと確定しているのに関連ページの取得に失敗した場合も、
    // 表が黙って欠落しないように知らせる
    process.stderr.write(
      '関連ページの取得に失敗したため、このinfobox定義ページの文芸的データベースを出力できません\n'
    );
  }

  const pages1hop =
    result1hop.status === 'fulfilled'
      ? dedupAndSortByPageRank(
          (result1hop.value as { links1hop?: Page[] }).links1hop,
          seen
        )
      : [];
  const pages2hop =
    result2hop.status === 'fulfilled'
      ? dedupAndSortByPageRank(
          (result2hop.value as { links2hop?: Page[] }).links2hop,
          seen
        )
      : [];

  if (pages1hop.length > 0) {
    const heading = hasLiterateDatabase
      ? '## 1 hop link（表に載っていないページ）'
      : '## 1 hop link';
    sections.push(`${heading}\n\n${renderGroups(buildGroups(pages1hop))}`);
  }
  if (pages2hop.length > 0) {
    sections.push(`## 2 hop link\n\n${renderGroups(buildGroups(pages2hop))}`);
  }
  if (sections.length > 0) {
    process.stdout.write(`# Related Pages\n\n${sections.join('\n\n')}\n`);
  }
};
