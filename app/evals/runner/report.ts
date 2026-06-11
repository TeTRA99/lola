// Scorecard writer — one JSON file per suite run under evals/results/
// (gitignored). Filename encodes the three comparison axes:
//   <suite>__<modelSlug>__<gitSha>__<timestamp>.json
// Diff two runs with `npm run eval:compare <a.json> <b.json>`.

/// <reference types="node" />
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type CaseResult = {
  id: string;
  pass: boolean;
  /** Per-scorer detail — shape varies by suite; compare.mjs treats it opaquely. */
  scores: Record<string, unknown>;
  latencyMs: number;
  /** What the model actually returned, for eyeballing failures. */
  raw?: unknown;
};

export type Scorecard = {
  suite: string;
  model: string;
  judgeModel?: string;
  gitSha: string;
  timestamp: string;
  summary: Record<string, unknown>;
  cases: CaseResult[];
};

const RESULTS_DIR = join(__dirname, '..', 'results');

export function gitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim();
  } catch {
    return 'unknown';
  }
}

export function writeScorecard(
  suite: string,
  model: string,
  summary: Record<string, unknown>,
  cases: CaseResult[],
  judgeModel?: string,
): string {
  const card: Scorecard = {
    suite,
    model,
    ...(judgeModel ? { judgeModel } : {}),
    gitSha: gitSha(),
    timestamp: new Date().toISOString(),
    summary,
    cases,
  };
  mkdirSync(RESULTS_DIR, { recursive: true });
  const slug = model.replace(/[/:]/g, '-');
  const ts = card.timestamp.replace(/[:.]/g, '-');
  const path = join(RESULTS_DIR, `${suite}__${slug}__${card.gitSha}__${ts}.json`);
  writeFileSync(path, JSON.stringify(card, null, 2));
  // Surface where the scorecard landed — jest swallows return values.
  console.log(`\n[evals] ${suite} scorecard → ${path}`);
  console.log(`[evals] ${suite} summary:`, JSON.stringify(summary, null, 2));
  return path;
}
