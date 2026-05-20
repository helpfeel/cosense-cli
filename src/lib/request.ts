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

import type { Credential } from './settings.ts';

interface RequestOptions {
  credential?: Credential;
  method?: 'GET' | 'POST';
  body?: unknown;
}

export const requestJson = async (
  url: string,
  options?: RequestOptions
): Promise<unknown> => {
  const headers: Record<string, string> = {};
  const credential = options?.credential;
  if (credential) {
    if (credential.type === 'serviceAccount') {
      headers['x-service-account-access-key'] = credential.value;
    } else {
      headers['x-personal-access-token'] = credential.value;
    }
  }
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
