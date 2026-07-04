import { parseFileUrl } from '../lib/parseUrl.ts';
import { requestJson } from '../lib/request.ts';
import { resolveFileCredential } from '../lib/resolveFileCredential.ts';

export const readFileInfoSummary =
  'ファイルのメタデータと抽出済みテキストを取得する';

export const readFileInfoHelp = `readFileInfo - ファイルのメタデータと抽出済みテキストを取得する

Usage:
  cosense readFileInfo <fileUrl> [--project <projectUrl>]

引数:
  <fileUrl>  ファイルのURL（例: https://scrapbox.io/files/5f151efbacbb17001a58f120.pdf）。query/hashは付けない

オプション:
  --project <projectUrl>  Service Account認証で取得する時に、ファイルが属するprojectのURLを指定する（例: https://scrapbox.io/example）。省略時はPersonal Access Tokenを使う

戻り値（top-levelの主なkey）:
  id            string   ファイルID
  projectName   string   ファイルが属するproject名
  text          string?  ファイルから抽出されたテキスト（画像のOCR、PDFの本文等）。先頭10000文字まで
  originalname  string?  アップロード時のファイル名
  contentType   string?  ファイルのContent-Type
  size          number?  ファイルのbyte数

例:
  cosense readFileInfo 'https://scrapbox.io/files/5f151efbacbb17001a58f120.pdf'

絞り込み例（jqで欲しい部分だけ抜き出す）:
  抽出済みテキストだけ:
    cosense readFileInfo <fileUrl> | jq -r '.text'

HTTPエラー:
  401/403: 認証・権限が無い。private projectのファイルはproject member権限が必要
  404: fileIdに対応するファイルが存在しない
`;

interface ParsedArgs {
  fileUrl: string;
  project?: string;
}

const parseArgs = (args: string[]): ParsedArgs => {
  const usage =
    'Usage: cosense readFileInfo <fileUrl> [--project <projectUrl>]';
  let project: string | undefined;
  const positional: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] as string;
    if (arg === '--project') {
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
  if (positional.length !== 1) {
    throw new Error(usage);
  }
  return { fileUrl: positional[0] as string, project };
};

export const readFileInfo = async (args: string[]): Promise<void> => {
  const { fileUrl, project } = parseArgs(args);
  const { origin, fileId } = parseFileUrl(fileUrl);
  const credential = resolveFileCredential(origin, project);
  const data = await requestJson(`${origin}/api/gcs/${fileId}/info`, {
    credential
  });
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
};
