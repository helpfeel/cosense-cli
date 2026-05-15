import { enrichTimestampsOf } from '../lib/enrichTimestamps.ts';
import { parseOrigin } from '../lib/parseUrl.ts';
import { requestJson } from '../lib/request.ts';
import { resolveUserCredential } from '../lib/settings.ts';

export const whoamiSummary = '現在の認証ユーザーの情報を取得する';

export const whoamiHelp = `whoami - 現在の認証ユーザーの情報を取得する

Usage:
  cosense whoami <origin>

引数:
  <origin>  Cosenseサーバーのorigin（例: https://scrapbox.io）

戻り値（top-levelの主なkey）:
  id                  string                 Cosense内部のID
  name                string                 ログイン名
  displayName         string                 表示名
  email               string                 メールアドレス
  photo               string                 アイコン画像URL
  provider            string                 認証プロバイダ（google / microsoft / saml 等）
  pageFilters         Array<{type, value}>   page list filter設定
  created             string                 作成時刻
  updated             string                 更新時刻
`;

export const whoami = async (args: string[]): Promise<void> => {
  const [originArg] = args;
  if (!originArg) throw new Error('Usage: cosense whoami <origin>');
  if (args.length > 1) {
    throw new Error(
      `Unexpected positional argument: ${args[1]}\nUsage: cosense whoami <origin>`
    );
  }
  const origin = parseOrigin(originArg);
  const credential = resolveUserCredential(origin);
  if (!credential) {
    throw new Error(
      `No Personal Access Token found for ${origin}. Run \`cosense login ${origin}\` to authenticate.`
    );
  }
  const data = (await requestJson(`${origin}/api/users/me`, {
    credential
  })) as Record<string, unknown>;
  enrichTimestampsOf(data);
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
};
