import { parseOrigin } from '../lib/parseUrl.ts';
import { settingsPath, writeUserToken } from '../lib/settings.ts';

export const loginSummary = 'Personal Access Tokenを設定ファイルに保存する';

export const loginHelp = `login - Personal Access Tokenを設定ファイルに保存する

Usage:
  cosense login <origin>

引数:
  <origin>  Cosenseサーバーのorigin（例: https://scrapbox.io）

動作:
  - PAT発行URL（<origin>/settings/personal-access-tokens）を出力し、PAT入力を求める
  - 入力されたPATを ~/.cosense/settings.json の users[] に書き込む
  - 同じoriginの既存entryは上書きされる
  - 設定ファイルとディレクトリは存在しなければ作成する（dir 0700, file 0600）
  - interactive terminal（TTY）でのみ動作する

環境変数:
  COSENSE_PAT  設定されていれば、ファイルに保存された認証情報より優先される
`;

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

export const login = async (args: string[]): Promise<void> => {
  const [originArg, ...rest] = args;
  if (!originArg) throw new Error('Usage: cosense login <origin>');
  if (rest.length > 0) {
    throw new Error(`Unexpected argument: ${rest[0]}`);
  }
  const origin = parseOrigin(originArg);

  if (!process.stdin.isTTY) {
    throw new Error(
      'cosense login must be run in an interactive terminal (TTY)'
    );
  }

  process.stdout.write(
    [
      `Personal Access Token (PAT) を発行する:`,
      `  ${origin}/settings/personal-access-tokens`,
      ``,
      `発行したPATを以下に貼り付けてEnter（入力は * でマスクされる）:`,
      `PAT: `
    ].join('\n')
  );

  const token = (await readMaskedLine()).trim();
  if (!token) {
    throw new Error('PAT is empty');
  }

  writeUserToken(origin, token);
  process.stdout.write(`Saved PAT for ${origin} to ${settingsPath}\n`);
};
