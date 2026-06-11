// Jest setupFile for the `evals` project ONLY (see jest.config.js).
// Loads the real OpenRouter key from app/.env.local into process.env so the
// gateway's apiKey() finds it — eval suites make LIVE calls. The unit project
// never loads this file, so `npm test` stays keyless and offline.

/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

if (process.env.RUN_EVALS === '1') {
  const envPath = join(__dirname, '..', '..', '.env.local');
  try {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  } catch {
    // No .env.local — calls will fail with 'auth'; the suite reports it.
    console.warn('[evals] no .env.local found — live calls will fail with auth errors');
  }
}
