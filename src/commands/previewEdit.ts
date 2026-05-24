import { randomBytes } from 'node:crypto';
import { parseProjectUrlStrict } from '../lib/parseUrl.ts';
import { requestJson } from '../lib/request.ts';
import { resolveUserCredential } from '../lib/settings.ts';

export const previewEditSummary =
  'ページ編集opsをdry-runしてpreviewIdを取得する';

export const previewEditHelp = `previewEdit - ページ編集opsをdry-runしてpreviewIdを取得する

Usage:
  cosense previewEdit <projectUrl> <pageId> < ops.json    既存ページの編集 (stdinはops JSON)
  cosense previewEdit --new <projectUrl> < body.txt       新規ページ作成 (stdinはプレーンテキスト本文)
  echo '<opsJSON>' | cosense previewEdit <projectUrl> <pageId>
  echo '<text>'    | cosense previewEdit --new <projectUrl>

引数:
  <projectUrl>  プロジェクトのURL (例: https://scrapbox.io/shokai)。 末尾に余分なpathがあるとerror
  <pageId>      編集対象ページのID。 readPage 出力の top-level "id" field から取得する

オプション:
  --new   stdin をプレーンテキスト本文として受け取り、 新規ページを作る。 改行で複数行に分割され、
          1行目が page title、 2行目以降が本文として扱われる。 ops JSON を組み立てる必要は無い

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

  「特定行を複数行に分割したい」場合は、insertBefore で対象lineIdの直前に複数行を挿入してから、
  対象行を delete する。ops は配列順に適用されるので「先に delete してから insertBefore」 とすると
  anchor が消えて 422 になる。

  ops は順次適用される。同じ lineId に対する insertBefore を [A, B, C] の順で並べると、
  適用後の行順は元行の直前に [A, B, C] が並ぶ（入力順が保たれる）。

戻り値（plain text）:
  previewId / expireAt / status (create or update) / project / title のヘッダー +
  ops summary + 適用後 page 全体。
  変更行の頭には > (新規) または * (更新) のマーカーと末尾 # <lineId> が付く。
  既存行(変更なし)はマーカーなし。
  preview は dry-run なのでこの段階ではpage URLは確定しない。 確定URLは submitEdit の出力で確認する。

  submitEdit でこのpreviewIdを渡してcommitを確定する。previewIdは5分でexpireする。

HTTPエラー:
  HTTP 401  認証なし
  HTTP 403  非memberまたはService Account（書き込みはPAT限定）
  HTTP 404  pageId に対応するpageが存在しない / pageId が不正な形式
  HTTP 409 {"error":"NotFastForward","latest":...}
            preview生成後にページが更新された。最新stateを再取得して ops を作り直す必要がある
  HTTP 422  ops が不正/存在しないlineId/replace に多行textを渡した等

ワークフロー例（既存ページの編集）:
  cosense readPage https://scrapbox.io/shokai/foo > page.json
  # page.json から top-level id (pageId) と編集したい行の lineId を把握する
  cosense previewEdit https://scrapbox.io/shokai <pageId> < ops.json
  # 出力の plain text を読み、適用後の状態を確認してから submit
  cosense submitEdit https://scrapbox.io/shokai <previewId>

ワークフロー例（新規ページ作成）:
  printf 'ページタイトル\\n本文1行目\\n本文2行目\\n' \\
    | cosense previewEdit --new https://scrapbox.io/shokai
  cosense submitEdit https://scrapbox.io/shokai <previewId>
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

interface ParsedArgs {
  isNew: boolean;
  projectUrl: string;
  pageId: string | undefined;
}

const parseArgs = (args: string[]): ParsedArgs => {
  const usage =
    'Usage: cosense previewEdit <projectUrl> <pageId> < ops.json (use --new <projectUrl> < body.txt for new pages)';
  let isNew = false;
  const positional: string[] = [];
  for (const arg of args) {
    if (arg === '--new') {
      if (isNew) {
        throw new Error(`Duplicate option: --new\n${usage}`);
      }
      isNew = true;
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
    return { isNew, projectUrl: positional[0] as string, pageId: undefined };
  }
  if (positional.length !== 2) {
    throw new Error(usage);
  }
  return {
    isNew,
    projectUrl: positional[0] as string,
    pageId: positional[1] as string
  };
};

export const previewEdit = async (args: string[]): Promise<void> => {
  const { isNew, projectUrl, pageId } = parseArgs(args);

  if (process.stdin.isTTY) {
    throw new Error(
      isNew
        ? 'previewEdit --new reads plain text body from stdin. Pipe it in, e.g. `printf "Title\\nbody\\n" | cosense previewEdit --new <projectUrl>`.'
        : 'previewEdit reads ops JSON from stdin. Pipe it in, e.g. `cosense previewEdit <projectUrl> <pageId> < ops.json`.'
    );
  }

  const { origin, projectName } = parseProjectUrlStrict(projectUrl);
  const stdinRaw = await readStdin();
  if (!stdinRaw.trim()) {
    throw new Error(
      isNew
        ? 'stdin is empty. Pipe page body (plain text) to stdin.'
        : 'stdin is empty. Pipe ops JSON to stdin.'
    );
  }

  // --new はプレーンテキスト本文を _end への単一 _insert に変換する。 ops JSON を組み立てる
  // 冗長さを避けるショートカット。 改行は translateOps が複数行 _insert に分割する。
  // body 全体に .trim() を当てると意図的な空行(先頭/末尾)が消えるので、 Unix line terminator
  // 慣習で末尾の単一改行 (LF または CRLF) だけ取り除く
  let ops: unknown;
  if (isNew) {
    const body = stdinRaw.replace(/\r?\n$/, '');
    ops = [{ insertBefore: '_end', text: body }];
  } else {
    let parsed: unknown;
    try {
      parsed = JSON.parse(stdinRaw);
    } catch (err) {
      throw new Error(
        `stdin is not valid JSON: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    ops = (parsed as { ops?: unknown }).ops;
  }
  const { changes, newLineIds, updatedLineIds } = translateOps(ops);

  // 書き込み系 API は PAT 限定 (Service Account 拒否) なので、PAT を直接解決する
  const credential = resolveUserCredential(origin);

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
