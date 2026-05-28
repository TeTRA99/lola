import {
  groupByDay, weekCounts, workingSignal, findZeroWeek,
  recentErrors, recentEventsWithin, dayKey,
  type UsageEvent,
} from '../UsageStats';

// Anchor "now" to a stable Wednesday so week buckets are predictable.
// 2026-05-27T15:00:00Z is a Wednesday.
const NOW = new Date('2026-05-27T15:00:00Z').getTime();
const DAY = 86_400_000;

function ev(action: 'describe' | 'ask', daysBack: number, success: number = 1): UsageEvent {
  return {
    id: Math.random(),
    occurred_at: NOW - daysBack * DAY,
    action,
    success,
    latency_ms: 1500,
    error_kind: success === 0 ? 'network' : null,
  };
}

describe('UsageStats.groupByDay', () => {
  test('counts describe + ask per day, descending order', () => {
    const events = [
      ev('describe', 0), ev('describe', 0), ev('ask', 0),
      ev('describe', 1),
      ev('ask', 2), ev('ask', 2),
    ];
    const days = groupByDay(events);
    expect(days).toHaveLength(3);
    expect(days[0].day > days[1].day).toBe(true); // descending
    expect(days[0].describe).toBe(2);
    expect(days[0].ask).toBe(1);
    expect(days[2].ask).toBe(2);
  });
});

describe('UsageStats.weekCounts', () => {
  test('aligns to Monday and includes current week even if empty', () => {
    const events: UsageEvent[] = [];
    const w = weekCounts(events, NOW);
    expect(w).toHaveLength(1);
    expect(w[0].total).toBe(0);
  });

  test('groups events into the correct Monday-anchored week', () => {
    const events = [
      ev('describe', 0), ev('describe', 1), ev('ask', 2), // current week (Wed back to Mon)
      ev('describe', 8),                                    // last week
    ];
    const w = weekCounts(events, NOW);
    expect(w.length).toBeGreaterThanOrEqual(2);
    expect(w[0].describe + w[0].ask).toBe(3);
    expect(w[1].describe).toBe(1);
  });
});

describe('UsageStats.workingSignal', () => {
  test('too_early when no completed weeks', () => {
    const r = workingSignal([], NOW);
    expect(r.kind).toBe('too_early');
  });

  test('pass when last completed week has ≥3 describe AND ≥3 ask', () => {
    // 8/9 days back from Wed 2026-05-27 = Tue/Mon of last week (Mon 2026-05-18 → Sun 2026-05-24)
    const events = [
      ev('describe', 8), ev('describe', 8), ev('describe', 9),
      ev('ask', 8), ev('ask', 8), ev('ask', 9),
    ];
    const r = workingSignal(events, NOW);
    expect(r.kind).toBe('pass');
  });

  test('fail when last completed week is under threshold', () => {
    const events = [
      ev('describe', 8), ev('describe', 9),  // only 2 describes in last completed week
      ev('ask', 8), ev('ask', 8), ev('ask', 9),  // 3 asks
    ];
    const r = workingSignal(events, NOW);
    expect(r.kind).toBe('fail');
    if (r.kind === 'fail') {
      expect(r.describe).toBe(2);
      expect(r.ask).toBe(3);
    }
  });
});

describe('UsageStats.findZeroWeek', () => {
  test('returns null when every completed week has activity', () => {
    const events = [ev('describe', 8), ev('describe', 15), ev('describe', 22)];
    expect(findZeroWeek(events, NOW)).toBeNull();
  });
  test('returns the iso of the first zero completed week', () => {
    // Activity 22 days back AND 0 days back, but the week 8-14 days ago is empty.
    const events = [ev('describe', 0), ev('describe', 22)];
    const r = findZeroWeek(events, NOW);
    expect(r).not.toBeNull();
  });
});

describe('UsageStats.recentErrors', () => {
  test('returns only success=0 rows, newest first', () => {
    const events = [
      ev('describe', 0, 1),
      ev('describe', 0, 0),
      ev('ask', 1, 0),
      ev('ask', 2, 1),
    ];
    const errs = recentErrors(events);
    expect(errs).toHaveLength(2);
    expect(errs[0].occurred_at > errs[1].occurred_at).toBe(true);
  });
  test('respects the limit', () => {
    const events = Array.from({ length: 25 }, (_, i) => ev('ask', i, 0));
    expect(recentErrors(events, 5)).toHaveLength(5);
  });
});

describe('UsageStats.recentEventsWithin', () => {
  test('filters by lookback window', () => {
    const events = [ev('describe', 0), ev('describe', 5), ev('describe', 30)];
    expect(recentEventsWithin(events, 14, NOW)).toHaveLength(2);
  });
});

describe('UsageStats.dayKey', () => {
  test('returns ISO yyyy-mm-dd', () => {
    expect(dayKey(new Date('2026-05-27T15:30:00Z').getTime())).toBe('2026-05-27');
  });
});
