import { COPY } from '../CopyModule';

function flatten(obj: unknown, path: string[] = []): { path: string; value: string }[] {
  if (typeof obj === 'string') return [{ path: path.join('.'), value: obj }];
  if (obj && typeof obj === 'object') {
    return Object.entries(obj).flatMap(([k, v]) => flatten(v, [...path, k]));
  }
  return [];
}

// Voseo = Argentine "vos" form. Tuteo = "tú" form. Banning the unambiguous
// tuteo verb conjugations (tienes/puedes/quieres/eres) + the "tú" pronoun.
// Deliberately not banning `\bte\b` — it's a valid voseo object pronoun ("te dejo").
const FORBIDDEN = [
  /\btú\b/i,
  /\btienes\b/i,
  /\bpuedes\b/i,
  /\bquieres\b/i,
  /\beres\b/i,
];

describe('CopyModule voseo enforcement', () => {
  const entries = flatten(COPY);

  // Sanity: there IS copy to check.
  test('COPY has strings to inspect', () => {
    expect(entries.length).toBeGreaterThanOrEqual(10);
  });

  for (const { path, value } of entries) {
    test(`"${path}" is voseo (no tuteo)`, () => {
      for (const pat of FORBIDDEN) {
        expect(value).not.toMatch(pat);
      }
    });
  }
});
