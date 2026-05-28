// Pure helpers for DebugScreen — group usage_events by day / week, surface
// the success criteria gate (Describe ≥3/wk AND Ask ≥3/wk) and zero-week
// failure signal. Kept separate so the data-shaping is unit-testable without
// a React-Native test harness.

export type UsageEvent = {
  id: number;
  occurred_at: number;
  action: string;
  success: number;
  latency_ms: number | null;
  error_kind: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export type DayCounts = { day: string; describe: number; ask: number; total: number };

export function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);  // YYYY-MM-DD UTC
}

export function groupByDay(events: UsageEvent[]): DayCounts[] {
  const map = new Map<string, DayCounts>();
  for (const e of events) {
    const day = dayKey(e.occurred_at);
    const cur = map.get(day) ?? { day, describe: 0, ask: 0, total: 0 };
    if (e.action === 'describe') cur.describe += 1;
    if (e.action === 'ask') cur.ask += 1;
    cur.total += 1;
    map.set(day, cur);
  }
  return [...map.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
}

export type WeekCounts = {
  weekStartMs: number;
  weekStartIso: string;
  describe: number;
  ask: number;
  total: number;
};

/**
 * Week buckets aligned to Monday 00:00 UTC. Returns most-recent first.
 */
export function weekCounts(events: UsageEvent[], nowMs: number = Date.now()): WeekCounts[] {
  const map = new Map<number, WeekCounts>();
  for (const e of events) {
    const start = mondayStart(e.occurred_at);
    const cur = map.get(start) ?? {
      weekStartMs: start,
      weekStartIso: new Date(start).toISOString().slice(0, 10),
      describe: 0,
      ask: 0,
      total: 0,
    };
    if (e.action === 'describe') cur.describe += 1;
    if (e.action === 'ask') cur.ask += 1;
    cur.total += 1;
    map.set(start, cur);
  }
  // Ensure the current week appears even if empty (helps zero-week flag rendering).
  const currentStart = mondayStart(nowMs);
  if (!map.has(currentStart)) {
    map.set(currentStart, {
      weekStartMs: currentStart,
      weekStartIso: new Date(currentStart).toISOString().slice(0, 10),
      describe: 0,
      ask: 0,
      total: 0,
    });
  }
  return [...map.values()].sort((a, b) => b.weekStartMs - a.weekStartMs);
}

function mondayStart(ms: number): number {
  const d = new Date(ms);
  // ISO weekday: Monday = 1, Sunday = 7
  const day = (d.getUTCDay() + 6) % 7;  // shift so Monday = 0
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - day);
  return d.getTime();
}

/**
 * Working-signal gate per Brief Success Criteria: Describe ≥3/wk AND Ask ≥3/wk
 * after week 2 post-sideload. Returns the result for the most-recent completed
 * full week (excludes the current in-progress week).
 */
export function workingSignal(events: UsageEvent[], nowMs: number = Date.now()):
  | { kind: 'too_early'; message: string }
  | { kind: 'pass'; weekIso: string }
  | { kind: 'fail'; weekIso: string; describe: number; ask: number }
{
  const weeks = weekCounts(events, nowMs);
  // Skip the current in-progress week (first element).
  const completed = weeks.slice(1);
  if (completed.length === 0) {
    return { kind: 'too_early', message: 'No complete weeks yet — need ≥1 full week of data.' };
  }
  const lastCompleted = completed[0];
  if (lastCompleted.describe >= 3 && lastCompleted.ask >= 3) {
    return { kind: 'pass', weekIso: lastCompleted.weekStartIso };
  }
  return {
    kind: 'fail',
    weekIso: lastCompleted.weekStartIso,
    describe: lastCompleted.describe,
    ask: lastCompleted.ask,
  };
}

/**
 * Failure signal per Brief: ANY full week with zero usage → pivot trigger.
 * Walks every completed week between the oldest event and now, including
 * weeks with NO events at all (which weekCounts() would otherwise omit).
 * Returns the week-start ISO of the first zero week found, or null.
 */
export function findZeroWeek(events: UsageEvent[], nowMs: number = Date.now()): string | null {
  if (events.length === 0) return null;
  const counts = new Map<number, number>();
  for (const e of events) {
    const start = mondayStart(e.occurred_at);
    counts.set(start, (counts.get(start) ?? 0) + 1);
  }
  const currentWeekStart = mondayStart(nowMs);
  const oldestEventWeek = Math.min(...events.map(e => mondayStart(e.occurred_at)));
  // Walk Mondays from oldest event's week up to (but excluding) the current week.
  for (let weekStart = oldestEventWeek; weekStart < currentWeekStart; weekStart += WEEK_MS) {
    if ((counts.get(weekStart) ?? 0) === 0) {
      return new Date(weekStart).toISOString().slice(0, 10);
    }
  }
  return null;
}

export function recentErrors(events: UsageEvent[], limit: number = 20): UsageEvent[] {
  return events
    .filter(e => e.success === 0)
    .sort((a, b) => b.occurred_at - a.occurred_at)
    .slice(0, limit);
}

export function recentEventsWithin(events: UsageEvent[], daysBack: number, nowMs: number = Date.now()): UsageEvent[] {
  const cutoff = nowMs - daysBack * DAY_MS;
  return events.filter(e => e.occurred_at >= cutoff);
}

// Re-export for convenience.
export { DAY_MS, WEEK_MS };
