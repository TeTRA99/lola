#!/usr/bin/env node
// Diff two scorecards of the SAME suite (baseline vs candidate):
//   npm run eval:compare evals/results/<a>.json evals/results/<b>.json
// Pure Node — reads JSON only, no React Native imports.

import { readFileSync } from 'node:fs';

const [a, b] = process.argv.slice(2);
if (!a || !b) {
  console.error('usage: npm run eval:compare <baseline.json> <candidate.json>');
  process.exit(1);
}

const base = JSON.parse(readFileSync(a, 'utf8'));
const cand = JSON.parse(readFileSync(b, 'utf8'));

if (base.suite !== cand.suite) {
  console.error(`suite mismatch: ${base.suite} vs ${cand.suite} — compare like with like`);
  process.exit(1);
}

console.log(`suite:     ${base.suite}`);
console.log(`baseline:  ${base.model} @ ${base.gitSha} (${base.timestamp})`);
console.log(`candidate: ${cand.model} @ ${cand.gitSha} (${cand.timestamp})`);
if (base.judgeModel || cand.judgeModel) {
  console.log(`judge:     ${base.judgeModel ?? '—'} vs ${cand.judgeModel ?? '—'}`);
  if (base.judgeModel !== cand.judgeModel) {
    console.log('  ⚠ different judges — judge-based scores are NOT comparable');
  }
}

// ── Summary deltas (recurse one level into nested objects like latencyMs) ──
console.log('\nsummary deltas (baseline → candidate):');
const keys = [...new Set([...Object.keys(base.summary), ...Object.keys(cand.summary)])];
for (const k of keys) {
  const bv = base.summary[k];
  const cv = cand.summary[k];
  if (typeof bv === 'number' || typeof cv === 'number') {
    printDelta(k, bv, cv);
  } else if (bv && cv && typeof bv === 'object' && !Array.isArray(bv)) {
    for (const sub of new Set([...Object.keys(bv), ...Object.keys(cv ?? {})])) {
      if (typeof bv[sub] === 'number' || typeof cv?.[sub] === 'number') {
        printDelta(`${k}.${sub}`, bv[sub], cv?.[sub]);
      }
    }
  }
}

function printDelta(label, bv, cv) {
  const fmt = v => (typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(3)) : '—');
  const delta =
    typeof bv === 'number' && typeof cv === 'number'
      ? ` (${cv - bv >= 0 ? '+' : ''}${fmt(cv - bv)})`
      : '';
  console.log(`  ${label.padEnd(24)} ${String(fmt(bv)).padStart(9)} → ${String(fmt(cv)).padStart(9)}${delta}`);
}

// ── Per-case flips — the cases that actually changed behavior ──
const baseById = new Map(base.cases.map(c => [c.id, c]));
const flips = { regressed: [], fixed: [], added: [], removed: [] };
for (const c of cand.cases) {
  const prev = baseById.get(c.id);
  if (!prev) flips.added.push(c.id);
  else if (prev.pass && !c.pass) flips.regressed.push(c.id);
  else if (!prev.pass && c.pass) flips.fixed.push(c.id);
}
const candIds = new Set(cand.cases.map(c => c.id));
flips.removed = base.cases.filter(c => !candIds.has(c.id)).map(c => c.id);

console.log('\ncase flips:');
console.log(`  regressed (pass→fail): ${flips.regressed.length ? flips.regressed.join(', ') : 'none'}`);
console.log(`  fixed     (fail→pass): ${flips.fixed.length ? flips.fixed.join(', ') : 'none'}`);
if (flips.added.length) console.log(`  new cases: ${flips.added.join(', ')}`);
if (flips.removed.length) console.log(`  removed cases: ${flips.removed.join(', ')}`);

for (const id of flips.regressed) {
  const c = cand.cases.find(x => x.id === id);
  console.log(`\n  ✗ ${id} — candidate returned:`);
  console.log(`    ${JSON.stringify(c.raw)}`);
}

process.exit(flips.regressed.length > 0 ? 2 : 0);
