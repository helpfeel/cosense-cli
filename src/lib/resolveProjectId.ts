import { requestJson } from './request.ts';
import { resolveCredential } from './settings.ts';

const cache = new Map<string, string>();

export const resolveProjectId = async (
  origin: string,
  projectName: string
): Promise<string> => {
  const cacheKey = `${origin}:${projectName.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const apiUrl = `${origin}/api/projects/${projectName}/users`;
  const credential = resolveCredential(origin, projectName);
  const data = (await requestJson(apiUrl, { credential })) as {
    projectId?: unknown;
  };
  if (typeof data.projectId !== 'string' || data.projectId === '') {
    throw new Error(
      `projectId not found in ${apiUrl} response. The Cosense server may be older than this CLI.`
    );
  }
  cache.set(cacheKey, data.projectId);
  return data.projectId;
};
