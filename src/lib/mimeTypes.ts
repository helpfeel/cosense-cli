import { extname } from 'node:path';

// アップロード時に申告するContent-Typeを拡張子から推定するマップ。網羅はしないが、
// browsePageが<cosense:file type="...">でファイル種別をAIに伝えられるよう、判明した型は足していく。
// ここに無い型は--content-typeで上書きしてもらう
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
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  doc: 'application/msword',
  xls: 'application/vnd.ms-excel',
  ppt: 'application/vnd.ms-powerpoint',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  json: 'application/json',
  html: 'text/html',
  zip: 'application/zip'
};

// 推定できない時にapplication/octet-streamを申告しない。octet-streamで申告するとserverが
// embedUrlから拡張子を落とすため、URLからファイル種別が読み取れなくなり、ページ本文での
// 埋め込み表示の判定もできなくなる
export const contentTypeForFile = (filePath: string): string | undefined => {
  const ext = extname(filePath).slice(1).toLowerCase();
  // a.constructorやa.__proto__はObject.prototypeのpropertyを引いてしまう
  return Object.hasOwn(MIME_TYPES, ext) ? MIME_TYPES[ext] : undefined;
};
