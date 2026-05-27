// Typed Result<T, E> for every service / adapter return.
// No raw exceptions reach the UI — adapters wrap failures in err(...).
// See architecture §4.2 and PRD NFR-7 / FR-6.4.

export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export const isOk = <T, E>(r: Result<T, E>): r is { ok: true; value: T } => r.ok;
export const isErr = <T, E>(r: Result<T, E>): r is { ok: false; error: E } => !r.ok;
