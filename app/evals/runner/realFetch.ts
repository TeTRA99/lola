// Real-network fetch for the evals Jest project.
//
// Under jest-expo, the sandbox `globalThis.fetch` is Expo's "winter" fetch built
// on the preset's stubbed ExpoFetchModule native classes — every call resolves
// instantly with `status: undefined`, which the gateway reads as err('unknown').
// Jest's node environment doesn't expose Node's own fetch inside the sandbox,
// so this is a minimal node:https implementation covering exactly what the
// gateway uses: method/headers/body/signal in; ok/status/json()/text() out.

/// <reference types="node" />
import { request } from 'node:https';

type FetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
};

export function realFetch(url: string | URL, init?: FetchInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = request(
      new URL(String(url)),
      { method: init?.method ?? 'GET', headers: init?.headers },
      res => {
        const chunks: Buffer[] = [];
        res.on('data', c => chunks.push(c as Buffer));
        res.on('end', () => {
          const status = res.statusCode ?? 0;
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({
            ok: status >= 200 && status < 300,
            status,
            json: async () => JSON.parse(text) as unknown,
            text: async () => text,
          } as Response);
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    if (init?.signal) {
      const abort = () => req.destroy(new Error('aborted'));
      if (init.signal.aborted) abort();
      else init.signal.addEventListener('abort', abort, { once: true });
    }
    if (init?.body) req.write(init.body);
    req.end();
  });
}
