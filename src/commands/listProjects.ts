import { enrichTimestampsOf } from '../lib/enrichTimestamps.ts';
import { parseOrigin } from '../lib/parseUrl.ts';
import { requestJson } from '../lib/request.ts';
import { resolveUserCredential } from '../lib/settings.ts';

export const listProjectsSummary = '自分が参加しているprojectの一覧を取得する';

export const listProjectsHelp = `listProjects - 自分が参加しているprojectの一覧を取得する

Usage:
  cosense listProjects <origin>

引数:
  <origin>  Cosenseサーバーのorigin（例: https://scrapbox.io）

戻り値（top-levelの主なkey）:
  projects  Array<Project>  updated降順

Project の field:
  id              string                       Cosense内部のID
  name            string                       project名（URLパス）
  displayName     string                       表示名
  publicVisible   boolean                      公開projectかどうか
  loginStrategies Array<string>                認証方法（google / microsoft / saml / email 等）
  plan            string?                      課金plan名
  additionalPlans { [planName]: boolean }      追加plan
  alert           object?                      project内に表示される通知
  usersCount      number                       メンバー数
  isMember        boolean                      自分がメンバーか
  billingId       string?                      billing ID
  created         string                       作成時刻
  updated         string                       更新時刻
  isOwner         boolean?                     自分がownerか
  isAdmin         boolean?                     自分がadminか
  adminsCount     number?                      admin数
`;

export const listProjects = async (args: string[]): Promise<void> => {
  const [originArg] = args;
  if (!originArg) throw new Error('Usage: cosense listProjects <origin>');
  if (args.length > 1) {
    throw new Error(
      `Unexpected positional argument: ${args[1]}\nUsage: cosense listProjects <origin>`
    );
  }
  const origin = parseOrigin(originArg);
  const credential = resolveUserCredential(origin);
  if (!credential) {
    throw new Error(
      `No Personal Access Token found for ${origin}. Run \`cosense login ${origin}\` to authenticate.`
    );
  }
  const data = (await requestJson(`${origin}/api/projects`, {
    credential
  })) as { projects?: Record<string, unknown>[] };
  if (data.projects) {
    data.projects.sort((a, b) => {
      const ua = typeof a.updated === 'number' ? a.updated : 0;
      const ub = typeof b.updated === 'number' ? b.updated : 0;
      return ub - ua;
    });
  }
  for (const project of data.projects ?? []) {
    enrichTimestampsOf(project);
  }
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
};
