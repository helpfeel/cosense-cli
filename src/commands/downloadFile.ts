import { parseFileUrl } from '../lib/parseUrl.ts';
import { downloadToFile } from '../lib/request.ts';
import { resolveFileCredential } from '../lib/resolveFileCredential.ts';

export const downloadFileSummary =
  'ファイル本体をダウンロードしてローカルに保存する';

export const downloadFileHelp = `downloadFile - ファイル本体をダウンロードしてローカルに保存する

Usage:
  cosense downloadFile <fileUrl> <outputPath> [--thumbnail] [--project <projectUrl>]

引数:
  <fileUrl>     ファイルのURL（例: https://scrapbox.io/files/5f151efbacbb17001a58f120.png）。query/hashは付けない
  <outputPath>  保存先ファイルパス。既存ファイルは上書きする。親ディレクトリは自動作成しない

オプション:
  --thumbnail             縮小版（thumbnail）を取得する。thumbnailが存在しないファイル（jpeg/png以外）は原本が返る
  --project <projectUrl>  Service Account認証で取得する時に、ファイルが属するprojectのURLを指定する（例: https://scrapbox.io/example）。省略時はPersonal Access Tokenを使う

出力（JSON）:
  path         string         保存したファイルの絶対パス
  contentType  string | null  取得したファイルのContent-Type
  size         number         保存したファイルのbyte数

例:
  cosense downloadFile 'https://scrapbox.io/files/5f151efbacbb17001a58f120.png' ./image.png
  cosense downloadFile 'https://scrapbox.io/files/5f151efbacbb17001a58f120.png' /tmp/thumb.png --thumbnail

HTTPエラー:
  401/403: 認証・権限が無い。private projectのファイルはproject member権限が必要
  404: fileIdに対応するファイルが存在しない

注記:
  動画ファイルはサーバー側の制限により取得できない場合がある
`;

interface ParsedArgs {
  fileUrl: string;
  outputPath: string;
  thumbnail: boolean;
  project?: string;
}

const parseArgs = (args: string[]): ParsedArgs => {
  const usage =
    'Usage: cosense downloadFile <fileUrl> <outputPath> [--thumbnail] [--project <projectUrl>]';
  let thumbnail = false;
  let project: string | undefined;
  const positional: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] as string;
    if (arg === '--thumbnail') {
      thumbnail = true;
    } else if (arg === '--project') {
      if (project !== undefined) {
        throw new Error(`--project specified multiple times\n${usage}`);
      }
      const value = args[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`--project requires a value\n${usage}`);
      }
      project = value;
      i += 1;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}\n${usage}`);
    } else {
      positional.push(arg);
    }
  }
  if (positional.length !== 2) {
    throw new Error(usage);
  }
  return {
    fileUrl: positional[0] as string,
    outputPath: positional[1] as string,
    thumbnail,
    project
  };
};

export const downloadFile = async (args: string[]): Promise<void> => {
  const { fileUrl, outputPath, thumbnail, project } = parseArgs(args);
  const { origin, fileId } = parseFileUrl(fileUrl);
  const credential = resolveFileCredential(origin, project);
  let requestUrl = `${origin}/files/${fileId}`;
  if (thumbnail) requestUrl += '?type=thumbnail';
  const result = await downloadToFile(requestUrl, outputPath, { credential });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
};
