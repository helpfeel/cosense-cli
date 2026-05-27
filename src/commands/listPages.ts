import { enrichTimestampsOf } from '../lib/enrichTimestamps.ts';
import { parseProjectUrl } from '../lib/parseUrl.ts';
import { requestJson } from '../lib/request.ts';
import { enrichPageUsers, fetchUserMap } from '../lib/resolveUsers.ts';
import { resolveCredential } from '../lib/settings.ts';

export const listPagesSummary = 'プロジェクトのページ一覧を取得する';

export const listPagesHelp = `listPages - プロジェクトのページ一覧を取得する

Usage:
  cosense listPages <projectUrl> [options]

引数:
  <projectUrl>  プロジェクトのURL（例: https://scrapbox.io/shokai/）

オプション:
  --sort <name>   ソート順（既定: updated）
                    updated   更新日時降順
                    created   作成日時降順
                    accessed  最終アクセス降順
                    linked    被リンク数降順
                    views     閲覧数降順
                    title     タイトル昇順
                  pinned page は常に先頭に来る
  --limit <N>     1リクエストで返るページ数（既定 100、最大 1000）
  --skip <N>      先頭から N 件スキップして取得（既定 0）
  --filter <name> リストされるページを絞り込む。
                  本文中に [name.icon] を持つページと
                  指定したnameを持つユーザーがこれまでに編集したページが返る
                  ユーザー名で絞り込む場合は user.displayName ではなく users.name を指定する
                  自分の名前は whoami コマンドで確認できる

戻り値（top-levelの主なkey）:
  projectName  string        プロジェクト名
  count        number        条件に一致する総ページ数
  limit        number        1リクエストで返るページ数の上限（既定 100）
  skip         number        スキップ件数（オフセット）
  pages        Array<Page>   ページのメタデータ配列

各 Page の主なfield:
  id, title, image, descriptions,
  user (作成者 User), lastUpdateUser (最終更新者 User | null), users (更新者リスト Array<User>),
  pin (pinned page なら正の値), views, linked,
  linesCount, charsCount,
  created, updated, accessed, lastAccessed (string)

User の field（user / lastUpdateUser / users[] で共通）:
  id           string   Cosense内部のID
  name         string?  ログイン名（自己紹介ページのタイトルや、本文中のアイコン記法で使われる）
  displayName  string?  表示名
  email        string?  メールアドレス

注意:
  - ページ本文（lines）は含まれない
  - 1000件を超える件数を1リクエストで取ることはできない。--skip でページネーションする
`;

const ALLOWED_SORTS = new Set([
  'updated',
  'created',
  'accessed',
  'linked',
  'views',
  'title'
]);

const NON_NEGATIVE_INT = /^(?:0|[1-9]\d*)$/;

interface ParsedArgs {
  url: string;
  sort?: string;
  limit?: string;
  skip?: string;
  filter?: string;
}

const parseArgs = (args: string[]): ParsedArgs => {
  const usage =
    'Usage: cosense listPages <projectUrl> [--sort <name>] [--limit <N>] [--skip <N>] [--filter <name>]';
  let url: string | undefined;
  const parsed: Partial<ParsedArgs> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    const next = (): string => {
      const value = args[i + 1];
      if (value === undefined) throw new Error(`${arg} requires a value`);
      i += 1;
      return value;
    };
    if (arg === '--sort') {
      const value = next();
      if (!ALLOWED_SORTS.has(value)) {
        throw new Error(
          `Unknown --sort value: ${value}. Allowed: ${[...ALLOWED_SORTS].join(', ')}`
        );
      }
      parsed.sort = value;
    } else if (arg === '--limit') {
      const value = next();
      if (!NON_NEGATIVE_INT.test(value)) {
        throw new Error(
          `--limit must be a non-negative integer, got: ${value}`
        );
      }
      parsed.limit = value;
    } else if (arg === '--skip') {
      const value = next();
      if (!NON_NEGATIVE_INT.test(value)) {
        throw new Error(`--skip must be a non-negative integer, got: ${value}`);
      }
      parsed.skip = value;
    } else if (arg === '--filter') {
      const value = next();
      if (value.trim() === '') {
        throw new Error('--filter must not be empty');
      }
      parsed.filter = value;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}\n${usage}`);
    } else if (!url) {
      url = arg;
    } else {
      throw new Error(`Unexpected positional argument: ${arg}\n${usage}`);
    }
  }
  if (!url) throw new Error(usage);
  return { url, ...parsed };
};

interface PageEntry {
  user?: { id: string } | null;
  lastUpdateUser?: { id: string } | null;
  users?: { id: string }[];
}

interface ListPagesData {
  pages?: PageEntry[];
}

export const listPages = async (args: string[]): Promise<void> => {
  const { url, sort, limit, skip, filter } = parseArgs(args);
  const { origin, projectName } = parseProjectUrl(url);
  const params = new URLSearchParams();
  if (sort) params.set('sort', sort);
  if (limit) params.set('limit', limit);
  if (skip) params.set('skip', skip);
  if (filter !== undefined) {
    params.set('filterType', 'icon');
    params.set('filterValue', filter);
  }
  const queryString = params.toString();
  const apiUrl = `${origin}/api/pages/${projectName}/${queryString ? `?${queryString}` : ''}`;
  const credential = resolveCredential(origin, projectName);
  const data = (await requestJson(apiUrl, { credential })) as ListPagesData;

  const userMap = await fetchUserMap(origin, projectName);
  for (const page of data.pages ?? []) {
    enrichPageUsers(page, userMap);
    enrichTimestampsOf(page as Record<string, unknown>);
  }

  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
};
