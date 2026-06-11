// Pure scoring core for the Debug room-ID eval (Charly-only tooling, English).
// No storage/native imports — fully unit-testable. The orchestration that feeds
// it real catalog data / runs CLIP lives in RoomEval.ts.

import { cosineSimilarity } from '@/utils/vector';

export type LabeledEmbedding = {
  photoId: number;
  /** Room display name as registered ("Cocina"). */
  room: string;
  embedding: number[];
};

export type EvalRow = {
  id: string;
  /** Expected room display name, or null = the photo must NOT match any room. */
  expected: string | null;
  /** Predicted room, or null = abstained ("no estoy segura"). */
  predicted: string | null;
  /** Best similarity seen (even when below threshold), null if nothing to compare. */
  similarity: number | null;
};

/** Key used for the abstain/unknown bucket in the confusion matrix. */
export const NONE = '(none)';

/**
 * Leave-one-out over the registered catalog photos: each photo is matched
 * against all OTHER stored photos with the same best-similarity + threshold
 * rule as RoomCatalog.identifyRoom(). Free (embeddings are already stored) and
 * needs no extra dataset. Bias note: catalog photos of a room are usually shot
 * in one session, so this OVERSTATES real accuracy — treat cross-room confusion
 * as the signal, and use the holdout set for honest accuracy.
 */
export function leaveOneOutRows(photos: LabeledEmbedding[], threshold: number): EvalRow[] {
  return photos.map(p => {
    let best: { room: string; sim: number } | null = null;
    for (const q of photos) {
      if (q.photoId === p.photoId) continue;
      const sim = cosineSimilarity(p.embedding, q.embedding);
      if (!best || sim > best.sim) best = { room: q.room, sim };
    }
    return {
      id: `photo-${p.photoId}`,
      expected: p.room,
      predicted: best && best.sim >= threshold ? best.room : null,
      similarity: best?.sim ?? null,
    };
  });
}

export type RoomEvalReport = {
  n: number;
  /** Correct predictions including correct abstains. */
  accuracy: number;
  /** rows = expected, cols = predicted; NONE bucket holds abstain/unknown. */
  confusion: Record<string, Record<string, number>>;
  perRoom: Record<string, { precision: number | null; recall: number | null; n: number }>;
  /** Of the expected-null photos, how many correctly abstained (null if none). */
  unknownAbstainRate: number | null;
};

const key = (room: string | null) => room ?? NONE;
const same = (a: string | null, b: string | null) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

export function buildReport(rows: EvalRow[]): RoomEvalReport {
  const confusion: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    const e = key(r.expected);
    (confusion[e] ??= {})[key(r.predicted)] = (confusion[e][key(r.predicted)] ?? 0) + 1;
  }
  const rooms = [...new Set(rows.flatMap(r => [r.expected, r.predicted]))]
    .filter((r): r is string => r !== null);
  const perRoom: RoomEvalReport['perRoom'] = {};
  for (const room of rooms) {
    const expectedHere = rows.filter(r => same(r.expected, room));
    const predictedHere = rows.filter(r => same(r.predicted, room));
    perRoom[room] = {
      recall: expectedHere.length
        ? expectedHere.filter(r => same(r.predicted, room)).length / expectedHere.length
        : null,
      precision: predictedHere.length
        ? predictedHere.filter(r => same(r.expected, room)).length / predictedHere.length
        : null,
      n: expectedHere.length,
    };
  }
  const unknowns = rows.filter(r => r.expected === null);
  return {
    n: rows.length,
    accuracy: rows.length
      ? rows.filter(r => same(r.expected, r.predicted)).length / rows.length
      : 0,
    confusion,
    perRoom,
    unknownAbstainRate: unknowns.length
      ? unknowns.filter(r => r.predicted === null).length / unknowns.length
      : null,
  };
}

/** Monospace text rendering for the Debug panel / clipboard export. */
export function formatReport(report: RoomEvalReport, threshold: number): string {
  const fmt = (v: number | null) => (v === null ? '—' : v.toFixed(2));
  const lines: string[] = [
    `n=${report.n}  accuracy=${fmt(report.accuracy)}  threshold=${threshold}`,
  ];
  const cols = [...new Set([
    ...Object.keys(report.confusion),
    ...Object.values(report.confusion).flatMap(r => Object.keys(r)),
  ])].sort();
  const w = Math.max(8, ...cols.map(c => c.length)) + 1;
  const pad = (s: string) => s.padEnd(w);
  lines.push('confusion (rows = expected):');
  lines.push(pad('') + cols.map(pad).join(''));
  for (const exp of cols) {
    if (!report.confusion[exp]) continue;
    lines.push(pad(exp) + cols.map(c => pad(String(report.confusion[exp][c] ?? ''))).join(''));
  }
  for (const [room, s] of Object.entries(report.perRoom)) {
    lines.push(`${room}: precision=${fmt(s.precision)} recall=${fmt(s.recall)} (n=${s.n})`);
  }
  if (report.unknownAbstainRate !== null) {
    lines.push(`unknown-room abstain rate: ${fmt(report.unknownAbstainRate)} (must be 1.00)`);
  }
  return lines.join('\n');
}
