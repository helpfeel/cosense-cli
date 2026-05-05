import { enrichTimestampsOf } from '../lib/enrichTimestamps.ts';
import { parseProjectUrl } from '../lib/parseUrl.ts';
import { requestJson } from '../lib/request.ts';
import { resolveCredential } from '../lib/settings.ts';

export const readProjectMembersSummary = 'プロジェクトのメンバー一覧を取得する';

export const readProjectMembersHelp = `readProjectMembers - プロジェクトのメンバー一覧を取得する

Usage:
  cosense readProjectMembers <projectUrl>

引数:
  <projectUrl>  プロジェクトのURL（例: https://scrapbox.io/shokai）

戻り値（top-levelの主なkey）:
  users           Array<User>          現メンバー一覧
  memberSnapshots Array<Snapshot>?     退去済みメンバーの記録

User の field:
  id           string    Cosense内部のID
  name         string?   ログイン名（自己紹介ページのタイトルや、本文中のアイコン記法で使われる）
  displayName  string?   表示名
  photo        string?   アイコン画像URL
  email        string?   メールアドレス
  provider     string?   認証プロバイダ（google / microsoft / saml 等）
  created      string?   作成時刻
  updated      string?   更新時刻

Snapshot の field:
  id      string                            snapshotのID
  reason  'deleted' | 'left'                退去理由
  created string                            退去者snapshot作成時刻
  updated string                            退去者snapshot更新時刻
  data    { id, name?, displayName?, email? } 退去時のユーザー情報

戻り値のJSON抜粋例:
{
  "users": [
    {
      "id": "5724627723541f110097c291",
      "name": "shokai",
      "displayName": "Sho Hashimoto",
      "email": "shokai@example.com",
      "provider": "google",
      "created": "2016-08-22T14:35+09:00 (9 years ago)",
      "updated": "2026-04-25T18:31+09:00 (5 days ago)"
    }
  ],
  "memberSnapshots": [
    {
      "id": "65a1...",
      "reason": "left",
      "created": "2023-11-14T15:33+09:00 (2 years ago)",
      "updated": "2023-11-14T15:33+09:00 (2 years ago)",
      "data": {
        "id": "59b8...",
        "name": "former-member",
        "displayName": "Former Member",
        "email": "former@example.com"
      }
    }
  ]
}
`;

export const readProjectMembers = async (args: string[]): Promise<void> => {
  const [url] = args;
  if (!url) throw new Error('Usage: cosense readProjectMembers <projectUrl>');
  if (args.length > 1) {
    throw new Error(
      `Unexpected positional argument: ${args[1]}\nUsage: cosense readProjectMembers <projectUrl>`
    );
  }
  const { origin, projectName } = parseProjectUrl(url);
  const apiUrl = `${origin}/api/projects/${projectName}/users`;
  const credential = resolveCredential(origin, projectName);
  const data = (await requestJson(apiUrl, { credential })) as {
    users?: Record<string, unknown>[];
    memberSnapshots?: Record<string, unknown>[];
  };
  for (const user of data.users ?? []) {
    enrichTimestampsOf(user, ['created', 'updated']);
  }
  for (const snap of data.memberSnapshots ?? []) {
    enrichTimestampsOf(snap, ['created', 'updated']);
  }
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
};
