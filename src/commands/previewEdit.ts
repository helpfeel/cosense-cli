import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseProjectUrlStrict } from '../lib/parseUrl.ts';
import { requestJson } from '../lib/request.ts';
import { resolveCredential } from '../lib/settings.ts';

export const previewEditSummary =
  'ページ編集opsをdry-runしてpreviewIdを取得する';

export const previewEditHelp = `previewEdit - ページ編集opsをdry-runしてpreviewIdを取得する

Usage:
  cosense previewEdit <projectUrl> <pageId> < ops.json      既存ページの編集 (stdinはops JSON)
  cosense previewEdit --new <projectUrl> < body.txt         新規ページ作成 (stdinはプレーンテキスト本文)
  cosense previewEdit --input-file ops.json <projectUrl> <pageId>
  cosense previewEdit --new --input-file body.txt <projectUrl>
  printf '%s' '<opsJSON>' | cosense previewEdit <projectUrl> <pageId>
  printf '%s' '<text>'    | cosense previewEdit --new <projectUrl>

引数:
  <projectUrl>  プロジェクトのURL (例: https://scrapbox.io/shokai)。 末尾に余分なpathがあるとerror
  <pageId>      編集対象ページのID。 readPage 出力の top-level "id" field から取得する
                ops 内の <lineId> は readPage 出力の lines[].id から取得する

オプション:
  --new   stdin をプレーンテキスト本文として受け取り、 新規ページを作る。 改行で複数行に分割され、
          1行目が page title、 2行目以降が本文として扱われる。 ops JSON を組み立てる必要は無い
  --input-file <path>
          stdin の代わりに UTF-8 テキストファイルから入力を読む。 指定時は stdin を読まない

stdinから受け取る入力形式（既存ページ編集モード, JSON）:
  {
    "ops": [
      {"insertBefore": "<lineId> | _end", "text": "..."},
      {"replace":      "<lineId>", "text": "..."},
      {"delete":       "<lineId>"}
    ]
  }

  insertBefore: <lineId> の直前に新規行を挿入する。textに改行(\\n)を含めると複数行を順に挿入する。
                anchor に "_end" を指定するとページ末尾に挿入する
  replace:      <lineId> の本文を置き換える。textは単行のみ。改行を含むtextは拒否される
  delete:       <lineId> の行を削除する

  ops は配列順に適用される。同じ anchor に対する insertBefore を [A, B, C] の順で並べると、
  適用後の行順は元行の直前に [A, B, C] が並ぶ（入力順が保たれる）。anchor は適用時点で存在
  する必要がある（消えた lineId を anchor に指定すると 422）。

戻り値（plain text）:
  previewId / expireAt / status (create or update) / project / title のヘッダー +
  ops summary + 適用後 page 全体。
  変更行の頭には > (新規) または * (更新) のマーカーと末尾 # <lineId> が付く。
  既存行(変更なし)はマーカーなし。
  preview は dry-run なのでこの段階ではpage URLは確定しない。 確定URLは submitEdit の出力で確認する。
  previewId は submitEdit に渡して commit を確定する。5分で expire する。

HTTPエラー:
  HTTP 401  認証なし
  HTTP 403  権限不足（PAT利用時、projectのmemberでない 等）
  HTTP 404  pageId に対応するpageが存在しない / pageId が不正な形式
  HTTP 409 {"error":"NotFastForward","latest":...}
            preview生成後にページが更新された。最新stateを再取得して ops を作り直す必要がある
  HTTP 422  ops が不正/存在しないlineId/replace に多行textを渡した等
`;

interface InsertBeforeOp {
  insertBefore: string;
  text?: string;
}

interface ReplaceOp {
  replace: string;
  text?: string;
}

interface DeleteOp {
  delete: string;
}

type Op = InsertBeforeOp | ReplaceOp | DeleteOp;

interface RawInsertChange {
  _insert: string;
  lines: { id: string; text: string };
}

interface RawUpdateChange {
  _update: string;
  lines: { text: string };
}

interface RawDeleteChange {
  _delete: string;
}

type RawChange = RawInsertChange | RawUpdateChange | RawDeleteChange;

interface PagePreview {
  title?: string;
  persistent?: boolean;
  lines?: { id: string; text: string }[];
}

interface PreviewResponse {
  previewId: string;
  expireAt: string;
  pagePreview: PagePreview | null;
}

const newLineId = (): string => randomBytes(12).toString('hex');

const opKind = (op: unknown): 'insertBefore' | 'replace' | 'delete' | null => {
  if (!op || typeof op !== 'object') return null;
  const o = op as Record<string, unknown>;
  const kinds = (['insertBefore', 'replace', 'delete'] as const).filter(
    k => k in o
  );
  if (kinds.length !== 1) return null;
  return kinds[0] ?? null;
};

interface TranslateResult {
  changes: RawChange[];
  newLineIds: Set<string>;
  updatedLineIds: Set<string>;
}

const translateOps = (ops: unknown): TranslateResult => {
  if (!Array.isArray(ops)) {
    throw new Error('ops must be an Array');
  }
  const changes: RawChange[] = [];
  const newLineIds = new Set<string>();
  const updatedLineIds = new Set<string>();

  for (const op of ops) {
    const kind = opKind(op);
    if (kind === null) {
      throw new Error(
        'each op must have exactly one of insertBefore / replace / delete'
      );
    }
    if (kind === 'insertBefore') {
      const o = op as InsertBeforeOp;
      if (typeof o.insertBefore !== 'string') {
        throw new Error('insertBefore must be a string lineId');
      }
      if (typeof o.text !== 'string') {
        throw new Error('insertBefore.text must be a string');
      }
      for (const lineText of o.text.split(/\r?\n/)) {
        const id = newLineId();
        changes.push({
          _insert: o.insertBefore,
          lines: { id, text: lineText }
        });
        newLineIds.add(id);
      }
    } else if (kind === 'replace') {
      const o = op as ReplaceOp;
      if (typeof o.replace !== 'string') {
        throw new Error('replace must be a string lineId');
      }
      if (typeof o.text !== 'string') {
        throw new Error('replace.text must be a string');
      }
      if (/\r?\n/.test(o.text)) {
        throw new Error(
          'replace does not support multi-line text. To split a line into multiple lines, insertBefore the new lines first, then delete the original line.'
        );
      }
      changes.push({ _update: o.replace, lines: { text: o.text } });
      updatedLineIds.add(o.replace);
    } else {
      const o = op as DeleteOp;
      if (typeof o.delete !== 'string') {
        throw new Error('delete must be a string lineId');
      }
      changes.push({ _delete: o.delete });
    }
  }

  return { changes, newLineIds, updatedLineIds };
};

const summarizeOp = (op: Op): string => {
  if ('insertBefore' in op) {
    const text = typeof op.text === 'string' ? op.text : '';
    const lineCount = text.split(/\r?\n/).length;
    return `  insertBefore ${op.insertBefore}: ${lineCount} line(s)`;
  }
  if ('replace' in op) {
    const text = typeof op.text === 'string' ? op.text : '';
    return `  replace      ${op.replace}: ${JSON.stringify(text)}`;
  }
  return `  delete       ${op.delete}`;
};

const formatPreview = (
  response: PreviewResponse,
  ops: Op[],
  ids: { newLineIds: Set<string>; updatedLineIds: Set<string> },
  projectName: string
): string => {
  const { pagePreview } = response;
  const status =
    pagePreview && pagePreview.persistent === false ? 'create' : 'update';
  const title = pagePreview?.title ?? '';
  const lines: string[] = [];
  lines.push(`previewId: ${response.previewId}`);
  lines.push(`expireAt:  ${response.expireAt}`);
  lines.push(`status:    ${status}`);
  lines.push(`project:   ${projectName}`);
  lines.push(`title:     ${title}`);
  lines.push('');
  lines.push('ops:');
  for (const op of ops) {
    lines.push(summarizeOp(op));
  }
  lines.push('');
  lines.push('page (after apply):');
  for (const line of pagePreview?.lines ?? []) {
    if (ids.newLineIds.has(line.id)) {
      lines.push(`> ${line.text} # ${line.id}`);
    } else if (ids.updatedLineIds.has(line.id)) {
      lines.push(`* ${line.text} # ${line.id}`);
    } else {
      lines.push(`  ${line.text}`);
    }
  }
  return lines.join('\n');
};

const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
};

// --input-file はバイト列を読んで UTF-8 として厳格に decode する。 TextDecoder の既定は
// ignoreBOM: false なので先頭 BOM を除去し、 fatal: true で BOM付き UTF-16 や不正バイトを
// 例外で弾く。 ただし BOM なし UTF-16LE は各バイトが偶然 valid UTF-8 になり fatal をすり抜けて
// NUL 混じり文字列になる事があるので、 decode 後に NUL を弾く。 stdin 経由 (readStdin の
// toString('utf8')) は不正バイトを置換して通すが、 こちらは「文字化けしたまま書き込み成功」を
// 防ぐため早期に失敗させる。
const readInputFileUtf8 = async (path: string): Promise<string> => {
  let bytes: Buffer;
  try {
    bytes = await readFile(path);
  } catch (err) {
    throw new Error(
      `--input-file: failed to read "${path}": ${err instanceof Error ? err.message : String(err)}`
    );
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(
      `--input-file: "${path}" is not valid UTF-8. Rewrite the file as UTF-8 (not UTF-16) and retry.`
    );
  }
  if (text.includes('\u0000')) {
    throw new Error(
      `--input-file: "${path}" contains NUL, which suggests UTF-16 or binary, not UTF-8 text. Rewrite the file as UTF-8 (not UTF-16) and retry.`
    );
  }
  return text;
};

interface ParsedArgs {
  isNew: boolean;
  projectUrl: string;
  pageId: string | undefined;
  inputFile: string | undefined;
}

const parseArgs = (args: string[]): ParsedArgs => {
  const usage =
    'Usage: cosense previewEdit <projectUrl> <pageId> < ops.json (use --new <projectUrl> < body.txt for new pages)';
  let isNew = false;
  let inputFile: string | undefined;
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    if (arg === '--new') {
      if (isNew) {
        throw new Error(`Duplicate option: --new\n${usage}`);
      }
      isNew = true;
    } else if (arg === '--input-file') {
      if (inputFile !== undefined) {
        throw new Error(`Duplicate option: --input-file\n${usage}`);
      }
      // 空文字を素通しすると後段の truthy 判定 (!inputFile / inputFile ? ...) で
      // 「未指定」と同じ扱いになり、 stdin を読んでしまう。 値欠落として弾く
      const value = args[++i];
      if (value === undefined || value === '') {
        throw new Error(`Missing value for --input-file\n${usage}`);
      }
      // 次トークンが別オプション (--new 等) の時はパスの書き忘れとみなし、 黙って
      // ファイル名として消費しない。 `--` 始まりの実ファイルは ./--name で渡せる
      if (value.startsWith('--')) {
        throw new Error(
          `--input-file expects a file path, but got "${value}". A path must immediately follow --input-file.\n${usage}`
        );
      }
      inputFile = value;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}\n${usage}`);
    } else {
      positional.push(arg);
    }
  }
  if (isNew) {
    if (positional.length !== 1) {
      throw new Error(
        'Usage: cosense previewEdit --new <projectUrl> < body.txt'
      );
    }
    return {
      isNew,
      projectUrl: positional[0] as string,
      pageId: undefined,
      inputFile
    };
  }
  if (positional.length !== 2) {
    throw new Error(usage);
  }
  return {
    isNew,
    projectUrl: positional[0] as string,
    pageId: positional[1] as string,
    inputFile
  };
};

export const previewEdit = async (args: string[]): Promise<void> => {
  const { isNew, projectUrl, pageId, inputFile } = parseArgs(args);

  if (!inputFile && process.stdin.isTTY) {
    throw new Error(
      isNew
        ? 'previewEdit --new reads plain text body from stdin or --input-file. Pipe it in, e.g. `printf "Title\\nbody\\n" | cosense previewEdit --new <projectUrl>`, or pass a UTF-8 file with `--input-file body.txt`.'
        : 'previewEdit reads ops JSON from stdin or --input-file. Pipe it in, e.g. `cosense previewEdit <projectUrl> <pageId> < ops.json`, or pass a UTF-8 file with `--input-file ops.json`.'
    );
  }

  const { origin, projectName } = parseProjectUrlStrict(projectUrl);
  const rawInput = inputFile
    ? await readInputFileUtf8(inputFile)
    : await readStdin();
  if (!rawInput.trim()) {
    const source = inputFile ? `input file "${inputFile}"` : 'stdin';
    throw new Error(
      isNew
        ? `${source} is empty. Provide page body (plain text).`
        : `${source} is empty. Provide ops JSON.`
    );
  }

  // --new はプレーンテキスト本文を _end への単一 _insert に変換する。 ops JSON を組み立てる
  // 冗長さを避けるショートカット。 改行は translateOps が複数行 _insert に分割する。
  // body 全体に .trim() を当てると意図的な空行(先頭/末尾)が消えるので、 Unix line terminator
  // 慣習で末尾の単一改行 (LF または CRLF) だけ取り除く
  let ops: unknown;
  if (isNew) {
    const body = rawInput.replace(/\r?\n$/, '');
    ops = [{ insertBefore: '_end', text: body }];
  } else {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawInput);
    } catch (err) {
      const source = inputFile ? `input file "${inputFile}"` : 'stdin';
      throw new Error(
        `${source} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    ops = (parsed as { ops?: unknown }).ops;
  }
  const { changes, newLineIds, updatedLineIds } = translateOps(ops);

  // projectに紐づくService Accountがあればそれを、無ければPATを使う（読み取りと同じ）
  const credential = resolveCredential(origin, projectName);

  const apiUrl = `${origin}/api/pages/v2/${projectName}/page-edit-for-ai/preview`;
  const requestBody = pageId ? { pageId, changes } : { changes };
  const response = (await requestJson(apiUrl, {
    credential,
    method: 'POST',
    body: requestBody
  })) as PreviewResponse;

  process.stdout.write(
    `${formatPreview(response, ops as Op[], { newLineIds, updatedLineIds }, projectName)}\n`
  );
};
