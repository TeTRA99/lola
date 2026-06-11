import { COPY } from '../CopyModule';
// The tuteo ban list lives with the eval scorers so the static copy check and
// the live model-output evals can't drift apart (single source of truth).
import { TUTEO_PATTERNS as FORBIDDEN } from '../../../evals/scorers/voseo';

function flatten(obj: unknown, path: string[] = []): { path: string; value: string }[] {
  if (typeof obj === 'string') return [{ path: path.join('.'), value: obj }];
  if (obj && typeof obj === 'object') {
    return Object.entries(obj).flatMap(([k, v]) => flatten(v, [...path, k]));
  }
  return [];
}

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
