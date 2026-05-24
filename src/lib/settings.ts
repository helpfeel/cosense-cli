import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

interface ProjectSetting {
  origin: string;
  projectNameLc: string;
  serviceAccount: string;
}

interface UserSetting {
  origin: string;
  token: string;
}

interface Settings {
  projects: ProjectSetting[];
  users: UserSetting[];
}

export type Credential =
  | { type: 'serviceAccount'; value: string }
  | { type: 'personalAccessToken'; value: string };

const SETTINGS_PATH = join(homedir(), '.cosense', 'settings.json');

let cache: { value: Settings | null } | undefined;

const parseProjects = (raw: unknown): ProjectSetting[] => {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    throw new Error(`${SETTINGS_PATH}: projects must be an array`);
  }
  const result: ProjectSetting[] = [];
  for (const [i, entry] of raw.entries()) {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`${SETTINGS_PATH}: projects[${i}] must be an object`);
    }
    const { url, serviceAccount } = entry as {
      url?: unknown;
      serviceAccount?: unknown;
    };
    if (typeof url !== 'string') {
      throw new Error(`${SETTINGS_PATH}: projects[${i}].url must be a string`);
    }
    if (typeof serviceAccount !== 'string') {
      throw new Error(
        `${SETTINGS_PATH}: projects[${i}].serviceAccount must be a string`
      );
    }
    if (serviceAccount.trim() === '') {
      throw new Error(
        `${SETTINGS_PATH}: projects[${i}].serviceAccount must not be empty`
      );
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(
        `${SETTINGS_PATH}: projects[${i}].url is not a valid URL: ${url}`
      );
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(
        `${SETTINGS_PATH}: projects[${i}].url must use http: or https: scheme: ${url}`
      );
    }
    const projectName = parsed.pathname.split('/').filter(Boolean)[0];
    if (!projectName) {
      throw new Error(
        `${SETTINGS_PATH}: projects[${i}].url must include a project path: ${url}`
      );
    }
    result.push({
      origin: parsed.origin,
      projectNameLc: projectName.toLowerCase(),
      serviceAccount
    });
  }
  return result;
};

const parseUsers = (raw: unknown): UserSetting[] => {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    throw new Error(`${SETTINGS_PATH}: users must be an array`);
  }
  const result: UserSetting[] = [];
  for (const [i, entry] of raw.entries()) {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`${SETTINGS_PATH}: users[${i}] must be an object`);
    }
    const { url, token } = entry as { url?: unknown; token?: unknown };
    if (typeof url !== 'string') {
      throw new Error(`${SETTINGS_PATH}: users[${i}].url must be a string`);
    }
    if (typeof token !== 'string') {
      throw new Error(`${SETTINGS_PATH}: users[${i}].token must be a string`);
    }
    if (token.trim() === '') {
      throw new Error(`${SETTINGS_PATH}: users[${i}].token must not be empty`);
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(
        `${SETTINGS_PATH}: users[${i}].url is not a valid URL: ${url}`
      );
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(
        `${SETTINGS_PATH}: users[${i}].url must use http: or https: scheme: ${url}`
      );
    }
    result.push({ origin: parsed.origin, token });
  }
  return result;
};

const parseSettings = (raw: unknown): Settings => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`${SETTINGS_PATH}: must be an object`);
  }
  const { projects, users } = raw as {
    projects?: unknown;
    users?: unknown;
  };
  return {
    projects: parseProjects(projects),
    users: parseUsers(users)
  };
};

const loadSettings = (): Settings | null => {
  if (cache) return cache.value;
  let raw: string;
  try {
    raw = readFileSync(SETTINGS_PATH, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      cache = { value: null };
      return null;
    }
    throw err;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `${SETTINGS_PATH}: invalid JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  const value = parseSettings(parsed);
  cache = { value };
  return value;
};

export const writeUserToken = (origin: string, token: string): void => {
  let raw: Record<string, unknown>;
  try {
    const text = readFileSync(SETTINGS_PATH, 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      throw new Error(
        `${SETTINGS_PATH}: invalid JSON: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error(`${SETTINGS_PATH}: must be an object`);
    }
    raw = parsed as Record<string, unknown>;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      raw = {};
    } else {
      throw err;
    }
  }

  const existing = Array.isArray(raw.users) ? (raw.users as unknown[]) : [];
  const filtered = existing.filter(entry => {
    if (typeof entry !== 'object' || entry === null) return true;
    const url = (entry as { url?: unknown }).url;
    if (typeof url !== 'string') return true;
    try {
      return new URL(url).origin !== origin;
    } catch {
      return true;
    }
  });
  filtered.push({ url: origin, token });
  raw.users = filtered;

  const dir = dirname(SETTINGS_PATH);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  writeFileSync(SETTINGS_PATH, `${JSON.stringify(raw, null, 2)}\n`, {
    mode: 0o600
  });
  chmodSync(SETTINGS_PATH, 0o600);
  cache = undefined;
};

export const settingsPath = SETTINGS_PATH;

const readEnvPatCredential = (): Credential | undefined => {
  const raw = process.env.COSENSE_PAT;
  if (typeof raw !== 'string') return undefined;
  const value = raw.trim();
  if (value === '') return undefined;
  return { type: 'personalAccessToken', value };
};

export const resolveCredential = (
  origin: string,
  projectName: string
): Credential | undefined => {
  const envCredential = readEnvPatCredential();
  if (envCredential) return envCredential;
  const settings = loadSettings();
  if (!settings) return undefined;
  const projectNameLc = projectName.toLowerCase();
  for (const project of settings.projects) {
    if (project.origin === origin && project.projectNameLc === projectNameLc) {
      return { type: 'serviceAccount', value: project.serviceAccount };
    }
  }
  for (const user of settings.users) {
    if (user.origin === origin) {
      return { type: 'personalAccessToken', value: user.token };
    }
  }
  return undefined;
};

export const resolveUserCredential = (
  origin: string
): Credential | undefined => {
  const envCredential = readEnvPatCredential();
  if (envCredential) return envCredential;
  const settings = loadSettings();
  if (!settings) return undefined;
  for (const user of settings.users) {
    if (user.origin === origin) {
      return { type: 'personalAccessToken', value: user.token };
    }
  }
  return undefined;
};
