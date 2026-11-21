import { downloadBlock } from '../lib/downloadBlock.ts';

export const downloadCodeBlockSummary =
  'コードブロックをダウンロードしてローカルに保存する';

export const downloadCodeBlockHelp = `downloadCodeBlock - コードブロックをダウンロードしてローカルに保存する

Usage:
  cosense downloadCodeBlock <codeBlockUrl> <outputPath>

引数:
  <codeBlockUrl>  コードブロックのURL（例: https://scrapbox.io/api/code/shokai/foo/script.js）。
                  browsePage の「コードブロック・テーブル」に出力される。query/hashは付けない
  <outputPath>    保存先ファイルパス。既存ファイルは上書きする。親ディレクトリは自動作成しない

保存される内容:
  同じページにある同じファイル名のコードブロックを、上から順に連結した1つのファイル。
  ファイル名は本文の code: の後ろの文字列。末尾に (言語名) を付けた code:Rakefile(rb) の
  ファイル名は Rakefile。
  コードブロックは、code: の行よりインデントが深い行が続く間。インデントが同じか浅い行で
  終わり、インデントの無い空行でも終わる

出力（JSON）:
  path         string         保存したファイルの絶対パス
  contentType  string | null  取得したファイルのContent-Type
  size         number         保存したファイルのbyte数

例:
  cosense downloadCodeBlock 'https://scrapbox.io/api/code/shokai/foo/script.js' ./script.js

HTTPエラー:
  401/403: 認証・権限が無い。private projectのコードブロックはproject member権限が必要
  404: ページが存在しない。または、そのファイル名のコードブロックがページに存在しないか、中身が1行も無い
`;

export const downloadCodeBlock = async (args: string[]): Promise<void> => {
  const usage = 'Usage: cosense downloadCodeBlock <codeBlockUrl> <outputPath>';
  const option = args.find(arg => arg.startsWith('--'));
  if (option !== undefined) {
    throw new Error(`Unknown option: ${option}\n${usage}`);
  }
  if (args.length !== 2) {
    throw new Error(usage);
  }
  const [codeBlockUrl, outputPath] = args as [string, string];
  const result = await downloadBlock('code', codeBlockUrl, outputPath);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
};
