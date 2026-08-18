import { parseFileUrl } from '../lib/parseUrl.ts';
import { requestJson } from '../lib/request.ts';
import { resolveFileCredential } from '../lib/resolveFileCredential.ts';

export const deleteFileSummary = 'ファイルをprojectから削除する';

export const deleteFileHelp = `deleteFile - ファイルをprojectから削除する

Usage:
  cosense deleteFile <fileUrl> [--project <projectUrl>]

引数:
  <fileUrl>  ファイルのURL（例: https://scrapbox.io/files/5f151efbacbb17001a58f120.pdf）。query/hashは付けない

オプション:
  --project <projectUrl>  Service Account認証で削除する時に、ファイルが属するprojectのURLを指定する（例: https://scrapbox.io/example）。省略時はPersonal Access Tokenを使う

出力（JSON）:
  success  boolean  削除に成功したらtrue

削除後、ファイルが所属するproject内でこのファイルを埋め込んでいるページの本文はサーバーが自動修正するため、クライアント側での本文修正は不要。

例:
  cosense deleteFile 'https://scrapbox.io/files/5f151efbacbb17001a58f120.pdf'

HTTPエラー:
  401/403: 認証・権限が無い。projectのmember権限（またはprojectのService Account）が必要
  404: fileIdに対応するファイルが存在しない
`;

interface ParsedArgs {
  fileUrl: string;
  project?: string;
}

const parseArgs = (args: string[]): ParsedArgs => {
  const usage = 'Usage: cosense deleteFile <fileUrl> [--project <projectUrl>]';
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

export const deleteFile = async (args: string[]): Promise<void> => {
  const { fileUrl, project } = parseArgs(args);
  const { origin, fileId } = parseFileUrl(fileUrl);
  const credential = resolveFileCredential(origin, project);
  if (!credential) {
    throw new Error(
      `No credential found for ${origin}. Run \`cosense login ${origin}\` to authenticate.`
    );
  }
  const data = (await requestJson(`${origin}/api/gcs/${fileId}`, {
    credential,
    method: 'DELETE'
  })) as { success?: unknown };
  if (data?.success !== true) {
    throw new Error(`unexpected delete response: ${JSON.stringify(data)}`);
  }
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
};
