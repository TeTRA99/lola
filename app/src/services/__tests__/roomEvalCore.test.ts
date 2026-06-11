import { leaveOneOutRows, buildReport, formatReport, NONE } from '../roomEvalCore';

const THRESHOLD = 0.55;

// Orthogonal-ish unit vectors so similarities are easy to reason about:
// same-room photos point the same way (sim 1), different rooms are orthogonal (sim 0).
const cocinaA = { photoId: 1, room: 'Cocina', embedding: [1, 0, 0] };
const cocinaB = { photoId: 2, room: 'Cocina', embedding: [1, 0, 0] };
const livingA = { photoId: 3, room: 'Living', embedding: [0, 1, 0] };
const livingB = { photoId: 4, room: 'Living', embedding: [0, 1, 0] };

describe('leaveOneOutRows', () => {
  test('matches each photo to its room sibling, never itself', () => {
    const rows = leaveOneOutRows([cocinaA, cocinaB, livingA, livingB], THRESHOLD);
    expect(rows).toHaveLength(4);
    for (const r of rows) {
      expect(r.predicted).toBe(r.expected);
      expect(r.similarity).toBeCloseTo(1);
    }
  });

  test('abstains when the best similarity is below the threshold', () => {
    // livingA's only neighbors are orthogonal cocina photos → best sim 0 → null.
    const rows = leaveOneOutRows([cocinaA, cocinaB, livingA], THRESHOLD);
    const living = rows.find(r => r.id === 'photo-3');
    expect(living?.predicted).toBeNull();
    expect(living?.similarity).toBeCloseTo(0);
  });

  test('a lone pair of cross-room lookalikes confuses each other', () => {
    // Two photos of different rooms pointing the same way: each photo's best
    // (only) neighbor is the other room — both rows are misclassified.
    const lookalike = { photoId: 9, room: 'Baño', embedding: [1, 0, 0] };
    const rows = leaveOneOutRows([cocinaA, lookalike], THRESHOLD);
    expect(rows[0]).toMatchObject({ expected: 'Cocina', predicted: 'Baño' });
    expect(rows[1]).toMatchObject({ expected: 'Baño', predicted: 'Cocina' });
  });
});

describe('buildReport', () => {
  const rows = [
    { id: 'a', expected: 'Cocina', predicted: 'Cocina', similarity: 0.9 },
    { id: 'b', expected: 'Cocina', predicted: 'Living', similarity: 0.7 },
    { id: 'c', expected: 'Living', predicted: 'Living', similarity: 0.8 },
    { id: 'd', expected: null, predicted: null, similarity: 0.3 },
    { id: 'e', expected: null, predicted: 'Cocina', similarity: 0.6 },
  ];
  const report = buildReport(rows);

  test('accuracy counts correct matches and correct abstains', () => {
    // a, c, d correct out of 5.
    expect(report.accuracy).toBeCloseTo(3 / 5);
  });

  test('confusion matrix buckets nulls under NONE', () => {
    expect(report.confusion['Cocina']).toEqual({ Cocina: 1, Living: 1 });
    expect(report.confusion[NONE]).toEqual({ [NONE]: 1, Cocina: 1 });
  });

  test('per-room precision/recall', () => {
    // Cocina: expected twice, hit once → recall 0.5; predicted twice, right once → precision 0.5.
    expect(report.perRoom['Cocina']).toEqual({ precision: 0.5, recall: 0.5, n: 2 });
    // Living: expected once, hit once → recall 1; predicted twice, right once → precision 0.5.
    expect(report.perRoom['Living']).toEqual({ precision: 0.5, recall: 1, n: 1 });
  });

  test('unknown-room abstain rate', () => {
    expect(report.unknownAbstainRate).toBeCloseTo(0.5);
  });

  test('formatReport renders the headline numbers', () => {
    const text = formatReport(report, THRESHOLD);
    expect(text).toContain('n=5');
    expect(text).toContain('threshold=0.55');
    expect(text).toContain('unknown-room abstain rate: 0.50');
    expect(text).toContain('Cocina: precision=0.50 recall=0.50 (n=2)');
  });
});
