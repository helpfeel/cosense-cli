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

export const parsePageUrl = (input: string): PageUrl => {
  const u = new URL(input);
  const parts = u.pathname.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new Error(
      `Page URL must be https://<host>/<project>/<title>, got: ${input}`
    );
  }
  return {
    origin: u.origin,
    projectName: parts[0] as string,
    encodedTitle: parts[1] as string
  };
};
