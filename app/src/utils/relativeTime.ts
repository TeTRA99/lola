// "hace 2 horas" style Spanish relative-time renderer.
// Used by AskService.handleMemory when speaking recall results.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function ago(fromMs: number, nowMs: number = Date.now()): string {
  const delta = Math.max(0, nowMs - fromMs);
  if (delta < MIN) return 'hace un momento';
  if (delta < HOUR) {
    const m = Math.floor(delta / MIN);
    return `hace ${m} minuto${m === 1 ? '' : 's'}`;
  }
  if (delta < DAY) {
    const h = Math.floor(delta / HOUR);
    return `hace ${h} hora${h === 1 ? '' : 's'}`;
  }
  const d = Math.floor(delta / DAY);
  return `hace ${d} día${d === 1 ? '' : 's'}`;
}
