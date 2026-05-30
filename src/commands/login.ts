import { parseOrigin, parseProjectUrlStrict } from '../lib/parseUrl.ts';
import {
  settingsPath,
  writeProjectServiceAccount,
  writeUserToken
} from '../lib/settings.ts';

export const loginSummary =
  'Personal Access Token または Service Account を設定ファイルに保存する';

export const loginHelp = `login - Personal Access Token または Service Account を設定ファイルに保存する

Usage:
  cosense login <origin|projectUrl>

引数:
  <origin>      Cosenseサーバーのorigin（例: https://scrapbox.io）
  <projectUrl>  プロジェクトURL（例: https://scrapbox.io/Nota）

動作:
  - 設定ファイル: ~/.cosense/settings.json（dir 0700, file 0600）
  - interactive terminal（TTY）でのみ動作する

環境変数:
  COSENSE_PAT  設定されていれば、ファイルに保存された認証情報より優先される
`;

const SERVICE_ACCOUNT_PREFIX = 'cs_';

const readMaskedLine = async (): Promise<string> => {
  if (!process.stdin.isTTY) {
    throw new Error(
      'cosense login must be run in an interactive terminal (TTY)'
    );
  }
  process.stdin.setRawMode(true);
  process.stdin.resume();
  const chars: string[] = [];
  const cleanup = (): void => {
    process.stdin.setRawMode(false);
    process.stdin.pause();
  };
  try {
    for await (const chunk of process.stdin) {
      const text = (chunk as Buffer).toString('utf8');
      for (const ch of text) {
        const code = ch.charCodeAt(0);
        if (code === 13 || code === 10) {
          process.stdout.write('\n');
          return chars.join('');
        }
        if (code === 3 || code === 4) {
          cleanup();
          process.stdout.write('\n');
          process.exit(130);
        }
        if (code === 127 || code === 8) {
          if (chars.length > 0) {
            chars.pop();
            process.stdout.write('\b \b');
          }
          continue;
        }
        if (code < 32) continue;
        chars.push(ch);
        process.stdout.write('*');
      }
    }
  } finally {
    cleanup();
  }
  process.stdout.write('\n');
  return chars.join('');
};

interface OriginTarget {
  kind: 'origin';
  origin: string;
}

interface ProjectTarget {
  kind: 'project';
  origin: string;
  projectName: string;
}

type LoginTarget = OriginTarget | ProjectTarget;

const parseTarget = (input: string): LoginTarget => {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error(
      `<origin|projectUrl> is not a valid URL: ${input}. ` +
        `例: https://scrapbox.io または https://scrapbox.io/<project>`
    );
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(
      `<origin|projectUrl> must use http: or https: scheme: ${input}`
    );
  }
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length === 0 && !url.search && !url.hash) {
    return { kind: 'origin', origin: parseOrigin(input) };
  }
  const { origin, projectName } = parseProjectUrlStrict(input);
  return { kind: 'project', origin, projectName };
};

const promptOrigin = (origin: string): void => {
  process.stdout.write(
    [
      `Personal Access Token (PAT) を発行する:`,
      `  ${origin}/settings/personal-access-tokens`,
      ``,
      `発行したPATを以下に貼り付けてEnter（入力は * でマスクされる）:`,
      `PAT: `
    ].join('\n')
  );
};

const promptProject = (origin: string, projectName: string): void => {
  process.stdout.write(
    [
      `Personal Access Token (PAT) を発行する:`,
      `  ${origin}/settings/personal-access-tokens`,
      ``,
      `または、Service Account を発行する（あなたが Business Project の管理者である場合）:`,
      `  1. ${origin}/${projectName} の Project Settings から Service Accounts ページを開く`,
      `  2. "Purpose of using API" に任意の内容を入力して Add`,
      `  3. 登録された Service Account の "Show Access Key" → Copy`,
      ``,
      `発行した PAT または Service Account を以下に貼り付けて Enter`,
      `（入力は * でマスクされる。Service Account は cs_ で始まる）:`,
      `TOKEN: `
    ].join('\n')
  );
};

export const login = async (args: string[]): Promise<void> => {
  const [targetArg, ...rest] = args;
  if (!targetArg) throw new Error('Usage: cosense login <origin|projectUrl>');
  if (rest.length > 0) {
    throw new Error(`Unexpected argument: ${rest[0]}`);
  }
  const target = parseTarget(targetArg);

  if (!process.stdin.isTTY) {
    throw new Error(
      'cosense login must be run in an interactive terminal (TTY)'
    );
  }

  if (target.kind === 'origin') {
    promptOrigin(target.origin);
  } else {
    promptProject(target.origin, target.projectName);
  }

  const token = (await readMaskedLine()).trim();
  if (!token) {
    throw new Error('Token is empty');
  }

  const isServiceAccount = token.startsWith(SERVICE_ACCOUNT_PREFIX);

  if (isServiceAccount) {
    if (target.kind === 'origin') {
      throw new Error(
        'Service Account を登録するには project URL を指定してください: ' +
          'cosense login <origin>/<project>'
      );
    }
    writeProjectServiceAccount(target.origin, target.projectName, token);
    process.stdout.write(
      `Saved Service Account for ${target.origin}/${target.projectName} to ${settingsPath}\n`
    );
    return;
  }

  writeUserToken(target.origin, token);
  process.stdout.write(`Saved PAT for ${target.origin} to ${settingsPath}\n`);
};
