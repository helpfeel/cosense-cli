import { requestJson } from './request.ts';
import { resolveCredential } from './settings.ts';

interface UserInfo {
  name?: string;
  displayName?: string;
  email?: string;
  isServiceAccount?: boolean;
  isServiceAccountDeleted?: boolean;
}

export type UserMap = Map<string, UserInfo>;

interface UserEntry {
  id?: unknown;
  name?: unknown;
  displayName?: unknown;
  email?: unknown;
}

interface MemberSnapshotEntry {
  data?: UserEntry;
}

interface ServiceAccountEntry {
  id?: unknown;
  usage?: unknown;
}

interface UsersResponse {
  users?: UserEntry[];
  memberSnapshots?: MemberSnapshotEntry[];
  serviceAccounts?: ServiceAccountEntry[];
  serviceAccountSnapshots?: ServiceAccountEntry[];
}

const cache = new Map<string, UserMap>();

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

// Service Account著者の表示名末尾に付ける注記。名前を文字列整形するコマンド
// (browsePage / browsePageChanges) で共用し、usageが人間名に見えるのを防ぐ
export const serviceAccountSuffix = (info: {
  isServiceAccount?: boolean;
  isServiceAccountDeleted?: boolean;
}): string => {
  if (!info.isServiceAccount) return '';
  return info.isServiceAccountDeleted
    ? ' (deleted service account)'
    : ' (service account)';
};

const buildUserInfo = (entry: UserEntry): UserInfo => {
  const info: UserInfo = {};
  const name = stringOrUndefined(entry.name);
  const displayName = stringOrUndefined(entry.displayName);
  const email = stringOrUndefined(entry.email);
  if (name) info.name = name;
  if (displayName) info.displayName = displayName;
  if (email) info.email = email;
  return info;
};

export const fetchUserMap = async (
  origin: string,
  projectName: string
): Promise<UserMap> => {
  const cacheKey = `${origin}:${projectName.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const apiUrl = `${origin}/api/projects/${projectName}/users`;
  const credential = resolveCredential(origin, projectName);
  const data = (await requestJson(apiUrl, { credential })) as UsersResponse;

  const map: UserMap = new Map();
  for (const entry of data.users ?? []) {
    const id = stringOrUndefined(entry.id);
    if (!id || map.has(id)) continue;
    map.set(id, buildUserInfo(entry));
  }
  for (const snap of data.memberSnapshots ?? []) {
    const entry = snap.data;
    if (!entry) continue;
    const id = stringOrUndefined(entry.id);
    if (!id || map.has(id)) continue;
    map.set(id, buildUserInfo(entry));
  }
  for (const entry of data.serviceAccounts ?? []) {
    const id = stringOrUndefined(entry.id);
    if (!id || map.has(id)) continue;
    map.set(id, {
      displayName: stringOrUndefined(entry.usage),
      isServiceAccount: true
    });
  }
  for (const entry of data.serviceAccountSnapshots ?? []) {
    const id = stringOrUndefined(entry.id);
    if (!id || map.has(id)) continue;
    map.set(id, {
      displayName: stringOrUndefined(entry.usage),
      isServiceAccount: true,
      isServiceAccountDeleted: true
    });
  }

  cache.set(cacheKey, map);
  return map;
};

interface UserRef {
  id: string;
  name?: string;
  displayName?: string;
  email?: string;
}

export const enrichUser = <T extends { id?: unknown }>(
  user: T | null | undefined,
  userMap: UserMap
): (T & UserRef) | null | undefined => {
  if (!user) return user;
  const id = stringOrUndefined(user.id);
  if (!id) return user as T & UserRef;
  const info = userMap.get(id);
  if (!info) return user as T & UserRef;
  return Object.assign(user, info) as T & UserRef;
};

interface UserRefHolder {
  user?: { id?: unknown } | null;
  lastUpdateUser?: { id?: unknown } | null;
  users?: ({ id?: unknown } | null | undefined)[];
}

export const enrichPageUsers = (
  page: UserRefHolder | null | undefined,
  userMap: UserMap
): void => {
  if (!page) return;
  enrichUser(page.user, userMap);
  enrichUser(page.lastUpdateUser, userMap);
  for (const editor of page.users ?? []) enrichUser(editor, userMap);
};
