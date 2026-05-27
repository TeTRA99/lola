import { Result, ok, err, isOk, isErr } from '../result';

describe('Result', () => {
  test('ok() produces a success result', () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(42);
  });

  test('err() produces a failure result', () => {
    const r = err<'boom'>('boom');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('boom');
  });

  test('isOk + isErr narrow the type', () => {
    const r: Result<number, string> = Math.random() > 2 ? ok(1) : err('x');
    if (isOk(r)) {
      // Inside this branch r.value: number is reachable
      const _v: number = r.value;
      expect(typeof _v).toBe('number');
    }
    if (isErr(r)) {
      const _e: string = r.error;
      expect(typeof _e).toBe('string');
    }
  });

  test('exhaustive switch over Result discriminant', () => {
    function handle(r: Result<number, 'a' | 'b'>): string {
      switch (r.ok) {
        case true:  return `value=${r.value}`;
        case false: return `error=${r.error}`;
      }
    }
    expect(handle(ok(3))).toBe('value=3');
    expect(handle(err('a'))).toBe('error=a');
  });
});
