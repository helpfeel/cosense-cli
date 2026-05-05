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
    super(
      `HTTP ${params.status} ${params.statusText}\n${params.url}\n${params.body.slice(0, 500)}`
    );
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
  const res = await fetch(url, { headers });
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
