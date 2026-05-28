import { ago } from '../relativeTime';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const NOW = new Date('2026-05-27T15:00:00Z').getTime();

describe('ago', () => {
  test('<1 min → hace un momento', () => {
    expect(ago(NOW - 30_000, NOW)).toBe('hace un momento');
    expect(ago(NOW - 59_999, NOW)).toBe('hace un momento');
  });

  test('minutes (singular/plural)', () => {
    expect(ago(NOW - 1 * MIN, NOW)).toBe('hace 1 minuto');
    expect(ago(NOW - 5 * MIN, NOW)).toBe('hace 5 minutos');
    expect(ago(NOW - 59 * MIN, NOW)).toBe('hace 59 minutos');
  });

  test('hours (singular/plural)', () => {
    expect(ago(NOW - 1 * HOUR, NOW)).toBe('hace 1 hora');
    expect(ago(NOW - 2 * HOUR, NOW)).toBe('hace 2 horas');
    expect(ago(NOW - 23 * HOUR, NOW)).toBe('hace 23 horas');
  });

  test('days (singular/plural)', () => {
    expect(ago(NOW - 1 * DAY, NOW)).toBe('hace 1 día');
    expect(ago(NOW - 3 * DAY, NOW)).toBe('hace 3 días');
  });

  test('negative delta clamps to 0 (future timestamp)', () => {
    expect(ago(NOW + 1000, NOW)).toBe('hace un momento');
  });
});
