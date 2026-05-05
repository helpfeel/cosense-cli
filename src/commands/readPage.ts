import { enrichTimestampsOf } from '../lib/enrichTimestamps.ts';
import { parsePageUrl } from '../lib/parseUrl.ts';
import { requestJson } from '../lib/request.ts';
import { fetchUserMap, enrichUser } from '../lib/resolveUsers.ts';
import { resolveCredential } from '../lib/settings.ts';

export const readPageSummary = '単一ページを読む';

export const readPageHelp = `readPage - 単一ページを読む

Usage:
  cosense readPage <pageUrl>

引数:
  <pageUrl>  読むページの完全なURL（例: https://scrapbox.io/shokai/foo）

戻り値（top-levelの主なkey）:
  title          string               ページタイトル
  persistent     boolean              実体のあるページなら true。false でも関連ページリストは存在する場合がある
  lines          Array<Line>          本文の行配列。Line = { id, text, user, created, updated }
  pageRank       number               ページの重要度指標。被リンクから計算される
  linked         number               被リンク数
  views          number               閲覧数
  created        string               ページ作成時刻
  updated        string               最終更新時刻
  accessed       string               最終アクセス時刻
  user           User                 作成者
  lastUpdateUser User | null          最終更新者（null の可能性あり）
  users          Array<User>          このページを編集した事のあるユーザー一覧
  links          string[]             本文中のリンク記法（[title]）のページタイトル
  linksLc        string[]             links[] を正規化（小文字化＋空白を _ に置換）した形式
  projectLinks   string[]             別プロジェクトへのリンク記法
  icons          string[]             [name.icon] 記法で挿入されたアイコン参照のページタイトル
  descriptions   string[]             冒頭数行の抜粋

User の field（user / lastUpdateUser / users[] / lines[].user で共通）:
  id           string   Cosense内部のID
  name         string?  ログイン名（自己紹介ページのタイトルや、本文中のアイコン記法で使われる）
  displayName  string?  表示名
  email        string?  メールアドレス

戻り値のJSON抜粋例:
{
  "title": "shokai",
  "persistent": true,
  "lines": [
    {
      "text": "shokai",
      "user": { "id": "5724627723541f110097c291", "name": "shokai" },
      "created": "2016-08-22T14:35+09:00 (9 years ago)",
      "updated": "2016-08-22T14:35+09:00 (9 years ago)"
    }
  ],
  "pageRank": 12,
  "linked": 7,
  "views": 22301,
  "links": ["Cosense"],
  "linksLc": ["cosense"],
  "projectLinks": [],
  "icons": ["shokai"],
  "user": { "id": "5724627723541f110097c291", "name": "shokai" },
  "lastUpdateUser": { "id": "5724627723541f110097c291", "name": "shokai" }
}

絞り込み例（jqで欲しい部分だけ抜き出す）:
  各行のテキストだけ:
    cosense readPage <pageUrl> | jq -r '.lines[].text'
`;

interface PageLine {
  id?: string;
  text?: string;
  userId?: string;
  user?: { id: string };
  created?: number;
  updated?: number;
}

interface PageData {
  user?: { id: string } | null;
  lastUpdateUser?: { id: string } | null;
  users?: { id: string }[];
  lines?: PageLine[];
}

export const readPage = async (args: string[]): Promise<void> => {
  const [url] = args;
  if (!url) throw new Error('Usage: cosense readPage <pageUrl>');
  const { origin, projectName, encodedTitle } = parsePageUrl(url);
  const apiUrl = `${origin}/api/pages/v2/${projectName}/${encodedTitle}`;
  const credential = resolveCredential(origin, projectName);
  const data = (await requestJson(apiUrl, { credential })) as PageData;

  if ((data as { persistent?: boolean }).persistent === false) {
    for (const field of [
      'user',
      'lastUpdateUser',
      'users',
      'linked',
      'created',
      'updated',
      'accessed',
      'lastAccessed',
      'snapshotCreated'
    ]) {
      delete (data as Record<string, unknown>)[field];
    }
    for (const line of data.lines ?? []) {
      for (const field of ['userId', 'user', 'created', 'updated']) {
        delete (line as Record<string, unknown>)[field];
      }
    }
  }

  const userMap = await fetchUserMap(origin, projectName);
  enrichUser(data.user, userMap);
  enrichUser(data.lastUpdateUser, userMap);
  for (const editor of data.users ?? []) {
    enrichUser(editor, userMap);
  }
  for (const line of data.lines ?? []) {
    const userId = line.userId;
    if (typeof userId === 'string' && userId !== '') {
      line.user = { id: userId };
      delete line.userId;
      enrichUser(line.user, userMap);
    }
    enrichTimestampsOf(line as Record<string, unknown>, ['created', 'updated']);
  }
  enrichTimestampsOf(data as Record<string, unknown>, [
    'created',
    'updated',
    'accessed',
    'snapshotCreated',
    'lastAccessed'
  ]);

  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
};
