import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { contentTypeForFile } from '../lib/mimeTypes.ts';
import { parseProjectUrlStrict } from '../lib/parseUrl.ts';
import { requestJson } from '../lib/request.ts';
import { resolveProjectId } from '../lib/resolveProjectId.ts';
import { resolveCredential } from '../lib/settings.ts';

export const uploadFileSummary =
  'ファイルをprojectにアップロードして埋め込みURLを取得する';

export const uploadFileHelp = `uploadFile - ファイルをprojectにアップロードして埋め込みURLを取得する

Usage:
  cosense uploadFile <projectUrl> <filePath> [--content-type <type>]

引数:
  <projectUrl>  アップロード先projectのURL（例: https://scrapbox.io/example）。末尾に余分なpathがあるとerror
  <filePath>    アップロードするローカルファイルのパス

オプション:
  --content-type <type>  ファイルのMIME type

出力（JSON）:
  embedUrl      string   ページ本文への埋め込みに使うファイルURL
  originalname  string   アップロードしたファイル名
  contentType   string?  ファイルのMIME type
  size          number   ファイルのbyte数

例:
  cosense uploadFile 'https://scrapbox.io/example' ./photo.png
  cosense uploadFile 'https://scrapbox.io/example' ./data.bin --content-type application/x-foo

HTTPエラー:
  401/403: 認証・権限が無い。projectのmember権限（またはprojectのService Account）が必要
  402: projectのファイル容量上限を超えている
`;

interface ParsedArgs {
  projectUrl: string;
  filePath: string;
  contentType?: string;
}

const parseArgs = (args: string[]): ParsedArgs => {
  const usage =
    'Usage: cosense uploadFile <projectUrl> <filePath> [--content-type <type>]';
  let contentType: string | undefined;
  const positional: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] as string;
    if (arg === '--content-type') {
      if (contentType !== undefined) {
        throw new Error(`--content-type specified multiple times\n${usage}`);
      }
      const value = args[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`--content-type requires a value\n${usage}`);
      }
      contentType = value;
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
    projectUrl: positional[0] as string,
    filePath: positional[1] as string,
    contentType
  };
};

// request.tsのHttpErrorは401/403でcosense loginを案内するが、GCSのsigned URLへの
// PUT失敗にログイン案内は誤誘導なので専用のエラーメッセージを組み立てる
const uploadToSignedUrl = async (
  url: string,
  body: Uint8Array,
  contentType: string | undefined
): Promise<void> => {
  const res = await fetch(url, {
    method: 'PUT',
    headers: contentType ? { 'Content-Type': contentType } : {},
    body
  });
  if (res.ok) {
    await res.body?.cancel();
    return;
  }
  const text = await res.text().catch(() => '');
  let message = `Upload to signed URL failed: HTTP ${res.status} ${res.statusText}\n${text.slice(0, 500)}`;
  if (res.status === 403) {
    message += '\n\nしばらく待ってから再実行すると成功する事がある';
  }
  throw new Error(message);
};

interface UploadRequestResponse {
  embedUrl?: string;
  originalname?: string;
  contentType?: string;
  signedUrl?: string;
  fileId?: string;
}

interface VerifyResponse {
  embedUrl?: string;
  originalname?: string;
}

export const uploadFile = async (args: string[]): Promise<void> => {
  const { projectUrl, filePath, contentType: contentTypeArg } = parseArgs(args);
  const { origin, projectName } = parseProjectUrlStrict(projectUrl);
  const credential = resolveCredential(origin, projectName);
  if (!credential) {
    throw new Error(
      `No credential found for ${origin}/${projectName}. Run \`cosense login ${origin}/${projectName}\` to authenticate.`
    );
  }

  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) {
    throw new Error(`<filePath> is not a file: ${filePath}`);
  }

  const body = await readFile(filePath);
  const md5 = createHash('md5').update(body).digest('hex');
  const contentType = contentTypeArg ?? contentTypeForFile(filePath);
  const name = basename(filePath);

  const projectId = await resolveProjectId(origin, projectName);

  const uploadRequest = (await requestJson(
    `${origin}/api/gcs/${projectId}/upload-request`,
    {
      credential,
      method: 'POST',
      body: { md5, size: body.length, contentType, name }
    }
  )) as UploadRequestResponse;

  let embedUrl: string | undefined;
  let originalname: string | undefined;
  let resultContentType = contentType;
  if (uploadRequest.embedUrl) {
    // 同一ファイルがアップロード済みの場合、serverはupload-requestで即embedUrlを返す。
    // embedUrlが配信するのは保存済みファイルなので、ローカル推定の型は当てにならない
    embedUrl = uploadRequest.embedUrl;
    originalname = uploadRequest.originalname ?? name;
    resultContentType = uploadRequest.contentType?.trim() || undefined;
  } else {
    const { signedUrl, fileId } = uploadRequest;
    if (!signedUrl || !fileId) {
      throw new Error(
        `Unexpected upload-request response: ${JSON.stringify(uploadRequest)}`
      );
    }
    await uploadToSignedUrl(signedUrl, body, contentType);
    const verify = (await requestJson(`${origin}/api/gcs/${projectId}/verify`, {
      credential,
      method: 'POST',
      body: { md5, fileId }
    })) as VerifyResponse;
    embedUrl = verify.embedUrl;
    originalname = verify.originalname ?? name;
  }
  if (!embedUrl) {
    throw new Error('Unexpected response: embedUrl is missing.');
  }

  const result = {
    embedUrl,
    originalname,
    contentType: resultContentType,
    size: body.length
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
};
