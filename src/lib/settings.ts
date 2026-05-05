import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

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

export const resolveCredential = (
  origin: string,
  projectName: string
): Credential | undefined => {
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
