import { downloadBlock } from '../lib/downloadBlock.ts';

export const downloadTableSummary =
  'テーブルをCSVでダウンロードしてローカルに保存する';

export const downloadTableHelp = `downloadTable - テーブルをCSVでダウンロードしてローカルに保存する

Usage:
  cosense downloadTable <tableUrl> <outputPath>

引数:
  <tableUrl>    テーブルのURL（例: https://scrapbox.io/api/table/shokai/foo/members.csv）。
                browsePage の「コードブロック・テーブル」に出力される。query/hashは付けない
  <outputPath>  保存先ファイルパス。既存ファイルは上書きする。親ディレクトリは自動作成しない

保存される内容:
  同じページにある同じ名前のテーブルを、上から順に連結した1つのCSVファイル。
  テーブルは、table: の行よりインデントが深い行が続く間。インデントが同じか浅い行で
  終わり、インデントの無い空行でも終わる

出力（JSON）:
  path         string         保存したファイルの絶対パス
  contentType  string | null  取得したファイルのContent-Type
  size         number         保存したファイルのbyte数

例:
  cosense downloadTable 'https://scrapbox.io/api/table/shokai/foo/members.csv' ./members.csv

HTTPエラー:
  401/403: 認証・権限が無い。private projectのテーブルはproject member権限が必要
  404: ページが存在しない。または、その名前のテーブルがページに存在しないか、中身が1行も無い
`;

export const downloadTable = async (args: string[]): Promise<void> => {
  const usage = 'Usage: cosense downloadTable <tableUrl> <outputPath>';
  const option = args.find(arg => arg.startsWith('--'));
  if (option !== undefined) {
    throw new Error(`Unknown option: ${option}\n${usage}`);
  }
  if (args.length !== 2) {
    throw new Error(usage);
  }
  const [tableUrl, outputPath] = args as [string, string];
  const result = await downloadBlock('table', tableUrl, outputPath);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
};
