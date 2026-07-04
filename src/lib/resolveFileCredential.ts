import { parseProjectUrlStrict } from './parseUrl.ts';
import {
  resolveCredential,
  resolveUserCredential,
  type Credential
} from './settings.ts';

// fileUrlにはproject名が含まれないため、Service Account（project単位）を
// 使う時だけ--projectでprojectUrlを受け取って解決する
export const resolveFileCredential = (
  fileOrigin: string,
  projectUrl: string | undefined
): Credential | undefined => {
  if (projectUrl === undefined) {
    return resolveUserCredential(fileOrigin);
  }
  const { origin, projectName } = parseProjectUrlStrict(projectUrl);
  if (origin !== fileOrigin) {
    throw new Error(
      `--project origin mismatch: ${origin} (--project) vs ${fileOrigin} (file URL)`
    );
  }
  const credential = resolveCredential(origin, projectName);
  if (!credential) {
    throw new Error(
      `No credential found for --project ${projectUrl}. Run \`cosense login ${projectUrl}\` to authenticate.`
    );
  }
  return credential;
};
