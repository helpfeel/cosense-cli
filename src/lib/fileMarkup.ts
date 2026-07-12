import { requestJson } from './request.ts';
import type { Credential } from './settings.ts';

// 本文中のGCSアップロードファイルURL。末尾の (?![^\s[\]]) 境界で、直後に空白・bracket・
// 行末以外（?・#・余分なpath等）が続くURLは弾き、clean URLだけをマッチする。query/hash
// 付き等はマッチせず本文にそのまま残る。拡張子は .tar.gz 等の多重ドットも丸ごと取る
const FILE_URL_PATTERN =
  /https?:\/\/[^\s[\]]+\/files\/([0-9a-f]{24})(?:\.[A-Za-z0-9]+)*(?![^\s[\]])/g;

// Gyazo URLの変種（i.gyazo.com/<hash>.<ext>、/raw付き、t.gyazo.com/teams/<team>/<hash>）
// もまとめてマッチし、hashでoEmbedを引く。FILE_URL_PATTERNと同じ末尾境界でquery/hash付きは残す
const GYAZO_URL_PATTERN =
  /https?:\/\/(?:[a-z0-9-]+\.)?gyazo\.com\/(?:teams\/[^\s/[\]]+\/)?([0-9a-f]{32})(?:\/raw|\.[A-Za-z0-9]+)?(?![^\s[\]])/g;

// 本文の行を1回のスキャンで両方置換するための結合パターン
const EMBED_URL_PATTERN = new RegExp(
  `${FILE_URL_PATTERN.source}|${GYAZO_URL_PATTERN.source}`,
  'g'
);

interface FileInfo {
  contentType?: string;
  originalname?: string;
  size?: number;
  text?: string;
}

interface GyazoOEmbed {
  type?: string;
  url?: string;
  thumbnail_url?: string;
  // 読めないhashでも200が返り、width/heightが空文字になる。numberであることが
  // 実体の存在確認になる
  width?: number | string;
  height?: number | string;
  title?: string;
}

// browsePage出力全体の肥大を防ぐ。全文が必要ならreadFileInfoで取れる
const DESCRIPTION_MAX_CHARS = 2000;

// 雰囲気マークアップを1行に収めて本文の行構造を保つ
const escapeAttr = (value: string): string =>
  value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');

const renderFileTag = (url: string, info: FileInfo): string => {
  const attrs: string[] = [];
  if (info.contentType) attrs.push(`type="${escapeAttr(info.contentType)}"`);
  attrs.push(`url="${escapeAttr(url)}"`);
  if (info.originalname) {
    attrs.push(`originalname="${escapeAttr(info.originalname)}"`);
  }
  if (typeof info.size === 'number') attrs.push(`size="${info.size}"`);
  const text = info.text?.trim();
  if (text) {
    const truncated =
      text.length > DESCRIPTION_MAX_CHARS
        ? `${text.slice(0, DESCRIPTION_MAX_CHARS)}…`
        : text;
    attrs.push(`description="${escapeAttr(truncated)}"`);
  }
  return `<cosense:file ${attrs.join(' ')}>`;
};

const renderGyazoTag = (
  url: string,
  hash: string,
  info: GyazoOEmbed
): string | null => {
  const attrs: string[] = [`type="${escapeAttr(info.type ?? '')}"`];
  attrs.push(`url="${escapeAttr(url)}"`);
  if (info.type === 'photo') {
    if (typeof info.width !== 'number' || !info.url) return null;
    attrs.push(`thumbnail="https://gyazo.com/${hash}/thumb/1000"`);
    attrs.push(`image="${escapeAttr(info.url)}"`);
  } else if (info.type === 'video') {
    if (!info.thumbnail_url) return null;
    attrs.push(`thumbnail="${escapeAttr(info.thumbnail_url)}"`);
  } else {
    return null;
  }
  if (typeof info.width === 'number') attrs.push(`width="${info.width}"`);
  if (typeof info.height === 'number') attrs.push(`height="${info.height}"`);
  if (info.title) attrs.push(`title="${escapeAttr(info.title)}"`);
  return `<cosense:gyazo ${attrs.join(' ')}>`;
};

const collectMatches = (
  lines: string[],
  pattern: RegExp
): Map<string, string> => {
  const found = new Map<string, string>();
  for (const line of lines) {
    for (const m of line.matchAll(pattern)) {
      found.set(m[0], m[1] as string);
    }
  }
  return found;
};

export const fetchFileMarkups = async (
  lines: string[],
  pageOrigin: string,
  pageCredential: Credential | undefined
): Promise<Map<string, string>> => {
  const files = collectMatches(lines, FILE_URL_PATTERN);
  const gyazos = collectMatches(lines, GYAZO_URL_PATTERN);
  const markups = new Map<string, string>();

  // ページと同じhostのアップロードファイルだけタグ展開する。cross-originのURLに
  // ページのcredential（env COSENSE_PATを含む）を送るとPAT漏洩になるため、別host・
  // 不正URL・取得失敗（404・権限なし・非公開Gyazo等）はいずれもURLのまま本文に残す。
  // 従来の出力と同じに劣化するだけで、AIはURLからファイルの存在を認知できる
  const fileTasks = [...files].map(async ([url, fileId]) => {
    try {
      if (new URL(url).origin !== pageOrigin) return;
      const info = (await requestJson(`${pageOrigin}/api/gcs/${fileId}/info`, {
        credential: pageCredential
      })) as FileInfo;
      markups.set(url, renderFileTag(url, info));
    } catch {}
  });

  // 同じhashの変種URLが複数あってもoEmbedは1回だけ引く
  const gyazoInfos = new Map<string, Promise<GyazoOEmbed | null>>();
  for (const hash of new Set(gyazos.values())) {
    gyazoInfos.set(
      hash,
      requestJson(
        `https://api.gyazo.com/api/oembed?url=https://gyazo.com/${hash}`
      ).then(
        info => info as GyazoOEmbed,
        () => null
      )
    );
  }
  const gyazoTasks = [...gyazos].map(async ([url, hash]) => {
    const info = await gyazoInfos.get(hash);
    if (!info) return;
    const markup = renderGyazoTag(url, hash, info);
    if (markup) markups.set(url, markup);
  });

  await Promise.all([...fileTasks, ...gyazoTasks]);
  return markups;
};

export const applyFileMarkup = (
  line: string,
  markups: Map<string, string>
): string => {
  if (markups.size === 0) return line;
  let out = '';
  let cursor = 0;
  for (const m of line.matchAll(EMBED_URL_PATTERN)) {
    const markup = markups.get(m[0]);
    if (!markup) continue;
    let start = m.index;
    let end = start + m[0].length;
    // 画像記法 [url] や強調 [[url]] はbracketごとタグに置き換える
    while (line[start - 1] === '[' && line[end] === ']') {
      start -= 1;
      end += 1;
    }
    out += line.slice(cursor, start) + markup;
    cursor = end;
  }
  return out + line.slice(cursor);
};
