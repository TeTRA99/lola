---
title: "Code Review — Sprint 1 + Sprint 2"
date: 2026-05-27
reviewer: "bmad-code-review (adversarial pass)"
scope: "All 1063 LOC across 21 source files; 75 tests across 9 suites"
commits_in_scope: e2368b2 .. 671c459
status: blockers-resolved
resolved_in_commit: e0af917
---

# Code Review — Sprint 1 + Sprint 2

Three-layer adversarial pass on the code that landed today.

## Triage summary

| Severity | Count |
|---|---|
| 🔴 BLOCKER (real bug, fix before sideload) | 5 |
| 🟡 NIT (design smell, document or fix opportunistically) | 7 |
| 🔵 AC-MISS (acceptance criterion not actually satisfied) | 2 |
| ⚪ OBSERVATION (worth knowing, no action needed) | 4 |

---

## 🔴 BLOCKERS

### B1. `haptics.fire('thinking_start')` leaks timers if called twice

[`haptics.ts:47`](../../app/src/adapters/haptics.ts) — top-of-function guard reads:
```ts
if (pattern !== 'thinking_start') clearThinking();
```
When `thinking_start` fires twice in a row (e.g., DescribeService.run() called rapidly, or AskService chained), the second call **skips** `clearThinking()`, then line 90 overwrites `thinkingTimer` with a new `setInterval`, **leaking the original interval**. Two parallel rhythmic pulses run until any non-`thinking_start` pattern fires.

**Repro:** call `fire('thinking_start')` twice without an intervening pattern.

**Fix:**
```ts
case 'thinking_start':
  clearThinking();  // explicit guard for repeated start
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  thinkingTimer = setInterval(...);
  return;
```

### B2. OpenRouter `parsed.objects` schema validation is shallow

[`openrouter.ts:113`](../../app/src/gateways/openrouter.ts) — checks `typeof narration === 'string'` and `Array.isArray(parsed.objects)` but **does not validate each object's `canonical`, `display`, `room_hint` fields**.

A model response like `{ "narration": "ok", "objects": [{}, {}] }` passes validation. DescribeService then logs sightings with `o.canonical === undefined` (E5.1 dependency) and HomeScreen's catalog injection breaks.

**Fix:** validate each object element:
```ts
const objsOk = parsed.objects.every(o =>
  o && typeof o === 'object' &&
  typeof (o as LolaObject).canonical === 'string' &&
  typeof (o as LolaObject).display === 'string' &&
  ((o as LolaObject).room_hint === null || typeof (o as LolaObject).room_hint === 'string')
);
if (!objsOk) return err('parse_fail');
```

### B3. `storage.getDb()` caches a failed handle on migration error

[`storage.ts:82-86`](../../app/src/adapters/storage.ts):
```ts
if (dbSingleton) return dbSingleton;
dbSingleton = await SQLite.openDatabaseAsync(DB_NAME);
await migrate(dbSingleton);  // ← throws here, but dbSingleton already set
return dbSingleton;
```
If `migrate()` throws (corrupted schema, future SQLite incompat), `dbSingleton` is left pointing at the half-opened DB. Next `getDb()` returns it without retrying migrations. Every subsequent write hits an inconsistent schema.

**Fix:**
```ts
const db = await SQLite.openDatabaseAsync(DB_NAME);
try {
  await migrate(db);
} catch (e) {
  // Don't cache a half-migrated handle.
  throw e;
}
dbSingleton = db;
return dbSingleton;
```

### B4. OpenRouter retry blows NFR-1 latency budget

[`openrouter.ts:67-94`](../../app/src/gateways/openrouter.ts) — total worst-case latency when network is genuinely flaky:
- Attempt 1: 8s timeout + 250ms backoff
- Attempt 2: 8s timeout + 750ms backoff
- Attempt 3: 8s timeout → bubble err('network')

**Total: ~25 seconds**. NFR-1 says button-to-audio ≤2s. Dad presses Describe, hears nothing for 25 seconds, then a Spanish "no tengo señal" — *worse than failing fast*.

**Fix:** reduce per-attempt timeout to ~5s and retry-count to 1 (or 0):
```ts
const RETRY_DELAYS_MS = [500];      // 1 retry
const PER_ATTEMPT_TIMEOUT_MS = 5000;
```
Worst-case = 5 + 0.5 + 5 = ~10.5s. Still over NFR-1 in worst case but dad-friendly: failure is felt sooner.

OR (better): expose `opts.maxLatencyMs` and have the consumer pick — DescribeService might want aggressive (5s), background telemetry might want patient (30s).

### B5. CameraHost race: granted-permission-but-ref-not-mounted-yet

[`camera.ts:39-44`](../../app/src/adapters/camera.ts) + [`CameraHost.tsx:14-23`](../../app/src/adapters/CameraHost.tsx).

Flow:
1. App boots. CameraHost mounts, `useCameraPermissions()` returns `[undefined]`, returns `null` (CameraView not in tree).
2. Dad taps Describe → `captureSnapshot()` → `requestCameraPermissionsAsync()` → user grants.
3. Permission state changes; CameraHost re-renders → mounts CameraView.
4. **But `captureSnapshot()` is still in its first execution** — `cameraRef` is still `null`.
5. Returns `err('no_camera')` → dad hears "Algo se me cruzó".

**Fix:** in `captureSnapshot()`, if permission was JUST granted and `cameraRef` is null, wait briefly (e.g., poll for 1s) before giving up:
```ts
if (!cameraRef) {
  // Brief poll in case CameraHost is mid-mount
  for (let i = 0; i < 10 && !cameraRef; i++) {
    await new Promise(r => setTimeout(r, 100));
  }
  if (!cameraRef) return err('no_camera');
}
```

---

## 🔵 AC MISSES

### A1. AC2.2.6 (heartbeat no-silent-gap >250ms) not enforced

[`DescribeService.ts:78-92`](../../app/src/services/DescribeService.ts).

The architecture §4.3 + AC2.2.6 specify: **between any two heartbeat transitions, no silent gap >250ms**. Implementation just calls `fire()` inline. The actual gap depends on whatever's between:

- `fire('looking')` → `await captureSnapshot()` — camera init can take 500ms+ on cold start. **Silent gap.**
- `fire('thinking_stop')` → `fire('answer_ready')` — back-to-back, OK.
- `fire('answer_ready')` → `await speak()` — TTS doesn't fire haptic before audio. **Silent gap until audio starts** (~200-400ms on iOS).

**Fix:** the haptic state machine should fire a sustained or pulsing "still working" pattern between transitions, OR the architecture's no-silent-gap claim should be relaxed to "no silent gap >250ms *during* thinking phase." Either is acceptable; AC2.2.6 as currently written isn't met by the code.

Recommendation: relax the AC. Dad doesn't actually need continuous haptic during the 1.5-second model call — the *thinking* pulse covers that. The `looking → thinking_start` and `thinking_stop → answer_ready` transitions are <50ms wall time in the happy path anyway (camera capture is the long step inside `looking`).

### A2. AC1.3.6 — "all errors as Result.err, never thrown"

Mostly true, but: `tts.speak()` calls `Speech.speak(...)` which is fire-and-forget. If `expo-speech`'s implementation crashes synchronously (e.g., missing native module), the try/catch on line 41 catches it and returns `err('unknown')`. ✓ AC met.

However: `await speak(...)` calls in DescribeService use the **happy path of the Result** (line 119, 86, 104) — but the code **doesn't check `r.ok`**. If `speak` fails silently, the user hears nothing, and DescribeService proceeds as if the TTS happened. Not a bug per AC1.3.6 (Result IS returned), but worth flagging — services should check `r.ok` on every `await speak`.

---

## 🟡 NITS

### N1. STT supports only one concurrent listen()

`stt.ts:15` — `activeAbort` is module-local. If Describe and Ask are dispatched in parallel (no UI lock today), the second `listen()` clobbers the first's abort handler. The first can never be cancelled.

In v0.9 the UI prevents this (single-tap each button, 100ms grey-out), but the constraint isn't documented in the adapter.

**Fix:** add a JSDoc warning, or reject concurrent calls with `err('engine_unavailable')`.

### N2. `_setCameraRefForTests`/`_resetForTests` leak test-only API to prod builds

Multiple modules export `_resetForTests` / `_setCameraRefForTests` (camera, tts, stt, storage, haptics, DescribeService). These are reachable at runtime in production builds. A motivated caller could break cached state.

**Fix (cheap):** wrap each with `if (!__DEV__) throw new Error('test-only');` at function entry, OR use a `__tests__/` test-internal module pattern.

### N3. CONFIG is not frozen

`config.ts` — `as const` on individual array values but not on the object itself. Mutation at runtime is technically possible (`CONFIG.MODEL_ID = 'wrong'`). Won't happen in practice but `Object.freeze(CONFIG)` is a one-liner safety net.

### N4. `void Haptics.impactAsync(...)` discards a Promise

`haptics.ts:52, 58, 67, 89, 91` — `impactAsync` returns a Promise. We discard it with `void`. If the native call rejects (rare but possible: silent mode + system policy), the rejection is unhandled — Node would warn; React Native may log noise. Acceptable but cosmetic.

**Fix:** `.catch(() => {})` instead of `void`.

### N5. OpenRouter `apiKey()` is called twice per request

Line 56 + line 68. Read once into a local: micro-perf, but mostly readability.

### N6. `interimResults: false` means partial transcripts ARE returned as success

`stt.ts:73` — `if (t) transcript = t` accepts any non-empty string. If the user starts speaking and abruptly stops, `end` fires with a partial like `"¿Dónde está…"`. Currently surfaces as `ok(partial)`. Acceptable for the FR-2 use case (utterance router can handle partials), but worth documenting.

### N7. Missing telemetry kinds

`DescribeService.logEvent('describe', ...)` is the only action type currently written. AskService (E3.2) will add `'ask'`, but the schema doesn't enumerate the full enum. Worth adding a `type Action = 'describe' | 'ask' | 'repeat' | 'extend' | 'memory_hit' | 'error'` somewhere in services and using it as the function param type.

---

## ⚪ OBSERVATIONS

### O1. No integration test against the real expo-modules-core stack

All native modules are `jest.mock`-ed. First time the actual lib runs is in the EAS dev-client build. Known + accepted; sideload smoke test (E6.3) is the integration gate.

### O2. `lastDescribe` module-local in DescribeService

Two `run()` calls in flight would race. UI prevents concurrent runs (100ms grey-out, single-screen). E2.4 SnapshotCache replaces this with a proper cache — note in commit history.

### O3. `Speech.speak` is fire-and-forget on iOS

The `await speak(text)` in DescribeService resolves immediately after iOS schedules the audio, not when speech completes. If Charly wants the haptic `answer_ready` to land *with* the audio start (vs. before), tighten via `Speech.speak({ onStart })` callback. Currently the fire-before-speak ordering works fine — flagging in case it matters later.

### O4. `expo-image-manipulator` resize happens even on already-large-but-acceptable images

`camera.ts:60` — `if (longer <= MAX_DIMENSION)` returns the original. ✓ correct. But if `longer === 1024.0001` (edge case impossible with int dims), we'd resize. Not a real concern.

---

## Proposed Fix Batch

Of the 5 blockers, 4 have small fixes (≤10 lines each). B5 (CameraHost race) needs the most care. **Recommendation: bundle B1–B4 into one fix commit, B5 into a second commit because it touches both `camera.ts` and `CameraHost.tsx` and warrants its own test.**

Fix order:
1. **B3 storage migration cache** (10 min, +1 test) — highest impact, smallest blast radius
2. **B1 haptics timer leak** (5 min, +1 test for double-fire)
3. **B2 openrouter object validation** (15 min, +1 test for malformed objects)
4. **B4 latency budget** (5 min, mostly constant change + a test verifying total worst-case latency)
5. **B5 camera race** (30 min — the polling fallback + a manual test note about the race)

Total: ~1 hour of fix work, +5 new tests, brings the suite to ~80 passing.

A1 (AC2.2.6 unenforced) is a documentation update — relax the AC text in PRD/architecture to match what the code does. Not a code change.

Everything in the NIT and OBSERVATION columns can sit for v1.0 polish.
