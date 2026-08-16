import { extname } from 'node:path';

// アップロード時に申告するContent-Typeを拡張子から推定する最小マップ。
// 網羅せず、外れる型は--content-typeで上書きしてもらう
const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  weba: 'audio/webm',
  aac: 'audio/aac',
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  json: 'application/json',
  html: 'text/html',
  zip: 'application/zip'
};

export const contentTypeForFile = (filePath: string): string => {
  const ext = extname(filePath).slice(1).toLowerCase();
  return MIME_TYPES[ext] ?? 'application/octet-stream';
};
