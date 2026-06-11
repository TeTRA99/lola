// setupFilesAfterEnv for the `evals` project (see jest.config.js).
//
// 1. Restore a REAL fetch. Expo's winter runtime (pulled in by the jest-expo
//    preset setup) replaces the sandbox global fetch with a stub that resolves
//    instantly with no status. A beforeAll wins over any module-load-time
//    overwrite, so live gateway calls actually hit OpenRouter.
// 2. Long per-test timeout: project-level `testTimeout` isn't a valid Jest 29
//    project option, so it's set here. Live calls include the gateway's retry
//    budget and the judge model can be slow.

import { realFetch } from './realFetch';

jest.setTimeout(90000);

beforeAll(() => {
  (globalThis as { fetch: typeof fetch }).fetch = realFetch as typeof fetch;
});
