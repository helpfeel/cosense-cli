import { enrichTimestampsOf } from '../lib/enrichTimestamps.ts';
import { parseProjectUrl } from '../lib/parseUrl.ts';
import { requestJson } from '../lib/request.ts';
import { enrichPageUsers, fetchUserMap } from '../lib/resolveUsers.ts';
import { resolveCredential } from '../lib/settings.ts';

export const searchFullTextSummary = '本文全文を対象に検索する';

export const searchFullTextHelp = `searchFullText - 本文全文を対象に検索する

Usage:
  cosense searchFullText <projectUrl> <query> [--or] [--sort <pageRank|updated>]

引数:
  <projectUrl>  プロジェクトのURL（例: https://scrapbox.io/shokai/）
  <query>       検索クエリ

オプション:
  --or                       複数語のいずれかにマッチするページを返す（既定はAND）
  --sort <pageRank|updated>  並び順（既定はpageRank）

例:
  cosense searchFullText https://scrapbox.io/shokai/ "カレー うどん ラーメン" --or

戻り値（top-levelの主なkey）:
  projectName            string         プロジェクト名
  searchQuery            string         実行されたクエリ
  count                  number         ヒット総数
  limit                  number         1リクエストで返る上限
  pages                  Array<Page>    マッチしたページの配列
  existsExactTitleMatch  boolean        タイトル完全一致がある場合 true

各 Page の field:
  id              string         ページID
  title           string         ページタイトル
  user            User           作成者
  lastUpdateUser  User | null    最終更新者
  users           Array<User>    更新者リスト
  views           number         閲覧数
  linked          number         被リンク数
  created         string         作成日時
  updated         string         更新日時
  pageRank        number         PageRank
  linesCount      number         行数
  charsCount      number         文字数
  words           string[]       マッチした語の一覧
  lines           string[]       マッチした本文の行

User の field（user / lastUpdateUser / users[] で共通）:
  id           string   Cosense内部のID
  name         string?  ログイン名（自己紹介ページのタイトルや、本文中のアイコン記法で使われる）
  displayName  string?  表示名
  email        string?  メールアドレス

戻り値のJSON抜粋例:
{
  "projectName": "shokai",
  "count": 12,
  "pages": [
    { "id": "...", "title": "...", "words": ["codex"], "lines": ["...codexと相談する..."] }
  ]
}
`;

interface SearchFullTextData {
  pages?: {
    user?: { id: string } | null;
    lastUpdateUser?: { id: string } | null;
    users?: { id: string }[];
  }[];
}

interface ParsedArgs {
  projectUrl: string;
  query: string;
  or: boolean;
  sort?: string;
}

const parseArgs = (args: string[]): ParsedArgs => {
  const usage =
    'Usage: cosense searchFullText <projectUrl> <query> [--or] [--sort <pageRank|updated>]';
  let or = false;
  let sort: string | undefined;
  const positional: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] as string;
    if (arg === '--or') {
      or = true;
    } else if (arg === '--sort') {
      const value = args[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`--sort requires a value\n${usage}`);
      }
      if (value !== 'pageRank' && value !== 'updated') {
        throw new Error(`--sort must be pageRank or updated\n${usage}`);
      }
      sort = value;
      i += 1;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}\n${usage}`);
    } else {
      positional.push(arg);
    }
  }
  if (positional.length !== 2 || !positional[1]) {
    throw new Error(usage);
  }
  return {
    projectUrl: positional[0] as string,
    query: positional[1] as string,
    or,
    sort
  };
};

export const searchFullText = async (args: string[]): Promise<void> => {
  const { projectUrl, query, or, sort } = parseArgs(args);
  const { origin, projectName } = parseProjectUrl(projectUrl);
  let apiUrl = `${origin}/api/pages/${projectName}/search/query?q=${encodeURIComponent(query)}`;
  if (or) apiUrl += '&op=or';
  if (sort) apiUrl += `&sort=${sort}`;
  const credential = resolveCredential(origin, projectName);
  const data = (await requestJson(apiUrl, {
    credential
  })) as SearchFullTextData;

  const userMap = await fetchUserMap(origin, projectName);
  for (const page of data.pages ?? []) {
    enrichPageUsers(page, userMap);
    enrichTimestampsOf(page as Record<string, unknown>);
  }

  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
};
