export class HttpError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly url: string;
  readonly body: string;

  constructor(params: {
    status: number;
    statusText: string;
    url: string;
    body: string;
  }) {
    let message = `HTTP ${params.status} ${params.statusText}\n${params.url}\n${params.body.slice(0, 500)}`;
    if (params.status === 401 || params.status === 403) {
      let origin: string | undefined;
      try {
        origin = new URL(params.url).origin;
      } catch {
        origin = undefined;
      }
      if (origin) {
        message += `\n\nRun \`cosense login ${origin}\` to authenticate.`;
      }
    }
    super(message);
    this.name = 'HttpError';
    this.status = params.status;
    this.statusText = params.statusText;
    this.url = params.url;
    this.body = params.body;
  }
}

import { createWriteStream } from 'node:fs';
import { rename, rm, stat } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Credential } from './settings.ts';

interface RequestOptions {
  credential?: Credential;
  method?: 'GET' | 'POST';
  body?: unknown;
}

const buildCredentialHeaders = (
  credential?: Credential
): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (credential) {
    if (credential.type === 'serviceAccount') {
      headers['x-service-account-access-key'] = credential.value;
    } else {
      headers['x-personal-access-token'] = credential.value;
    }
  }
  return headers;
};

export const requestJson = async (
  url: string,
  options?: RequestOptions
): Promise<unknown> => {
  const headers = buildCredentialHeaders(options?.credential);
  const method = options?.method ?? 'GET';
  const init: RequestInit = { method, headers };
  if (options?.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new HttpError({
      status: res.status,
      statusText: res.statusText,
      url,
      body
    });
  }
  return res.json();
};

export interface DownloadResult {
  path: string;
  contentType: string | null;
  size: number;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export const downloadToFile = async (
  url: string,
  outputPath: string,
  options?: { credential?: Credential }
): Promise<DownloadResult> => {
  const absPath = resolve(outputPath);
  const targetStat = await stat(absPath).catch(() => null);
  if (targetStat?.isDirectory()) {
    throw new Error(`<outputPath> is a directory: ${outputPath}`);
  }
  const parentDir = dirname(absPath);
  const parentStat = await stat(parentDir).catch(() => null);
  if (!parentStat?.isDirectory()) {
    throw new Error(`Parent directory does not exist: ${parentDir}`);
  }

  const headers = buildCredentialHeaders(options?.credential);
  let res = await fetch(url, { headers, redirect: 'manual' });
  if (REDIRECT_STATUSES.has(res.status)) {
    const location = res.headers.get('location');
    await res.body?.cancel();
    if (!location) {
      throw new Error(`HTTP ${res.status} without Location header: ${url}`);
    }
    const redirectUrl = new URL(location, url);
    // credential headerは別originのredirect先に転送しない
    res = await fetch(redirectUrl);
    if (!res.ok) {
      await res.body?.cancel();
      throw new Error(
        `HTTP ${res.status} ${res.statusText} from ${redirectUrl.origin}${redirectUrl.pathname}`
      );
    }
  } else if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new HttpError({
      status: res.status,
      statusText: res.statusText,
      url,
      body
    });
  }
  if (!res.body) {
    throw new Error(`Empty response body: ${url}`);
  }

  const tmpPath = join(
    parentDir,
    `.${basename(absPath)}.${process.pid}.${Math.random().toString(36).slice(2)}.part`
  );
  try {
    await pipeline(
      Readable.fromWeb(res.body),
      createWriteStream(tmpPath, { flags: 'wx' })
    );
    const { size } = await stat(tmpPath);
    await rename(tmpPath, absPath);
    return {
      path: absPath,
      contentType: res.headers.get('content-type'),
      size
    };
  } catch (err) {
    await rm(tmpPath, { force: true }).catch(() => {});
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to write ${absPath}: ${message.replaceAll(tmpPath, absPath)}`
    );
  }
};
