// Two Jest projects (docs/design/evaluation.md):
//   unit  — the offline test suite. What `npm test` runs. Free, no network.
//   evals — LIVE OpenRouter calls that score model-output quality. Costs money,
//           so it's double-gated: `--selectProjects evals` AND RUN_EVALS=1
//           (evals/runner/harness.ts skips every suite without the flag).
module.exports = {
  projects: [
    {
      preset: 'jest-expo',
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
    },
    {
      preset: 'jest-expo',
      displayName: 'evals',
      testMatch: ['<rootDir>/evals/**/*.eval.ts'],
      setupFiles: ['<rootDir>/evals/runner/setup.ts'],
      // Restores a real fetch (the preset stubs it) + sets the live-call timeout.
      setupFilesAfterEnv: ['<rootDir>/evals/runner/setupAfterEnv.ts'],
    },
  ],
};
