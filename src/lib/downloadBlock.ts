import { type BlockKind, parseBlockUrl } from './parseUrl.ts';
import { type DownloadResult, downloadToFile } from './request.ts';
import { resolveCredential } from './settings.ts';

export const downloadBlock = async (
  kind: BlockKind,
  url: string,
  outputPath: string
): Promise<DownloadResult> => {
  const { origin, projectName, requestUrl } = parseBlockUrl(url, kind);
  const credential = resolveCredential(origin, projectName);
  return downloadToFile(requestUrl, outputPath, { credential });
};
