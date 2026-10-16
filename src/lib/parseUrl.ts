export interface ProjectUrl {
  origin: string;
  projectName: string;
}

export interface PageUrl extends ProjectUrl {
  encodedTitle: string;
}

export const parseOrigin = (input: string): string => {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error(`<origin> is not a valid URL: ${input}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`<origin> must use http: or https: scheme: ${input}`);
  }
  return url.origin;
};

// scrapbox.ioとcosen.seはドメイン移行中の同じCosenseで、どちらのURLも同じサーバーに届くのでcredentialを共有してよい
const EQUIVALENT_HOSTS = new Set(['scrapbox.io', 'cosen.se']);

// http(s)のURL同士で、credentialを共有してよいoriginかを判定する
export const isEquivalentOrigin = (
  a: URL | string,
  b: URL | string
): boolean => {
  const from = new URL(a);
  const to = new URL(b);
  if (from.protocol !== 'http:' && from.protocol !== 'https:') return false;
  return (
    from.protocol === to.protocol &&
    from.port === to.port &&
    (from.hostname === to.hostname ||
      (EQUIVALENT_HOSTS.has(from.hostname) &&
        EQUIVALENT_HOSTS.has(to.hostname)))
  );
};

export const parseProjectUrl = (input: string): ProjectUrl => {
  const u = new URL(input);
  const parts = u.pathname.split('/').filter(Boolean);
  if (parts.length < 1) {
    throw new Error(
      `Project URL must be https://<host>/<project>, got: ${input}`
    );
  }
  return { origin: u.origin, projectName: parts[0] as string };
};

export const parseProjectUrlStrict = (input: string): ProjectUrl => {
  const u = new URL(input);
  if (u.search || u.hash) {
    throw new Error(`Project URL must not have query/hash, got: ${input}`);
  }
  const m = u.pathname.match(/^\/([^/]+)\/?$/);
  if (!m) {
    throw new Error(
      `Project URL must be https://<host>/<project> (no extra path), got: ${input}`
    );
  }
  return { origin: u.origin, projectName: m[1] as string };
};

export interface FileUrl {
  origin: string;
  fileId: string;
}

export const parseFileUrl = (input: string): FileUrl => {
  const u = new URL(input);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error(`File URL must use http: or https: scheme: ${input}`);
  }
  if (u.search || u.hash) {
    throw new Error(
      `File URL must not have query/hash (use --thumbnail to fetch thumbnail), got: ${input}`
    );
  }
  const m = u.pathname.match(/^\/files\/([0-9a-f]{24})(?:\..*)?$/);
  if (!m) {
    throw new Error(
      `File URL must be https://<host>/files/<fileId>[.<ext>], got: ${input}`
    );
  }
  return { origin: u.origin, fileId: m[1] as string };
};

export const parsePageUrl = (input: string): PageUrl => {
  const u = new URL(input);
  const m = u.pathname.match(/^\/([^/]+)\/(.+?)\/?$/);
  if (!m) {
    throw new Error(
      `Page URL must be https://<host>/<project>/<title>, got: ${input}`
    );
  }
  const projectName = m[1] as string;
  const rawTail = m[2] as string;
  const encodedTitle = rawTail.replace(/\//g, '%2F');
  return { origin: u.origin, projectName, encodedTitle };
};
