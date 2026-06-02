// Cloud analogue of useGuideDetection (feat: cloud "guide me to it" spike).
//
// A cloud round-trip is ~1.5–3s, so this can't drive the per-frame haptic loop.
// Instead it RE-LOCALIZES intermittently: every CONFIG.GUIDE_CLOUD_POLL_MS it asks
// the layer to capture a still, sends it to the grounding model, turns the
// returned box into the same proximity the on-device path produces, and feeds it
// to onProximity — so the rest of the guide pipeline (haptics + audio) is reused
// unchanged. Polls never overlap (skip while one is in flight) and stop at
// GUIDE_CLOUD_MAX_POLLS (a cost backstop).

import { useEffect, useMemo, useRef, useState } from 'react';
import { CONFIG } from '@/config';
import * as Settings from '@/services/Settings';
import * as ModelRouter from '@/services/ModelRouter';
import { parseGroundingBox, proximityFromBox, type NormBox } from '@/adapters/objectDetection';
import { recordGuideTrace } from '@/adapters/guideTrace';

/** A captured frame ready to upload — base64 JPEG + its pixel dimensions. */
export type CapturedFrame = { base64: string; width: number; height: number };

export type CloudGuideState = {
  model: string;
  polls: number;
  lastLatencyMs: number | null;
  lastError: string | null;
  lastFound: boolean;
  // Latest normalized box (for the dev preview overlay) + its confidence.
  lastBox: NormBox | null;
  lastConfidence: number;
};

export function useCloudGuideDetection(opts: {
  /** What the user asked to be guided to (open-vocabulary, e.g. "el auricular"). */
  query: string;
  /** Saved-object reference photo (base64) when targeting === 'reference', else null. */
  refBase64: string | null;
  /** Run only while the camera is foregrounded/ready. */
  active: boolean;
  /** Grab one still from the layer's camera. Returns null if not ready. */
  capture: () => Promise<CapturedFrame | null>;
  /** Proximity 0..1 (centered+near) for a found box, or null when not found. */
  onProximity: (p: number | null) => void;
}) {
  const model = useMemo(
    () => Settings.getStringSync(Settings.KEYS.guideCloudModel, CONFIG.GUIDE_CLOUD_MODEL_DEFAULT),
    [],
  );
  const [state, setState] = useState<CloudGuideState>({
    model, polls: 0, lastLatencyMs: null, lastError: null, lastFound: false,
    lastBox: null, lastConfidence: 0,
  });

  // Keep the latest callbacks/inputs in refs so the polling effect can stay
  // mounted across re-renders without restarting the loop on every prop change.
  const captureRef = useRef(opts.capture);
  const onProxRef = useRef(opts.onProximity);
  const queryRef = useRef(opts.query);
  const refRef = useRef(opts.refBase64);
  captureRef.current = opts.capture;
  onProxRef.current = opts.onProximity;
  queryRef.current = opts.query;
  refRef.current = opts.refBase64;

  useEffect(() => {
    if (!opts.active) return;
    let cancelled = false;
    let inFlight = false;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;
      if (!inFlight && polls < CONFIG.GUIDE_CLOUD_MAX_POLLS) {
        inFlight = true;
        polls += 1;
        const t0 = Date.now();
        try {
          const frame = await captureRef.current();
          if (!cancelled && frame) {
            const res = await ModelRouter.ground({
              query: queryRef.current,
              frameBase64: frame.base64,
              refBase64: refRef.current,
              model,
            });
            const latencyMs = Date.now() - t0;
            if (cancelled) return;
            if (res.ok && res.value.found) {
              const box = parseGroundingBox(model, res.value.box, frame.width, frame.height);
              onProxRef.current(box ? proximityFromBox(box) : null);
              recordGuideTrace({
                at: t0, query: queryRef.current, model, found: !!box,
                box: res.value.box, confidence: res.value.confidence, latencyMs, error: null,
              });
              setState(s => ({ ...s, polls, lastLatencyMs: latencyMs, lastError: null, lastFound: !!box, lastBox: box, lastConfidence: res.value.confidence }));
            } else {
              onProxRef.current(null);
              const error = res.ok ? null : res.error;
              recordGuideTrace({
                at: t0, query: queryRef.current, model, found: false,
                box: res.ok ? res.value.box : null, confidence: res.ok ? res.value.confidence : 0,
                latencyMs, error,
              });
              setState(s => ({ ...s, polls, lastLatencyMs: latencyMs, lastError: error, lastFound: false, lastBox: null }));
            }
          } else if (!cancelled) {
            onProxRef.current(null);
          }
        } catch (e) {
          if (!cancelled) {
            onProxRef.current(null);
            recordGuideTrace({
              at: t0, query: queryRef.current, model, found: false, box: null,
              confidence: 0, latencyMs: Date.now() - t0, error: String(e),
            });
            setState(s => ({ ...s, polls, lastError: String(e), lastFound: false }));
          }
        } finally {
          inFlight = false;
        }
      }
      if (!cancelled) timer = setTimeout(() => void tick(), CONFIG.GUIDE_CLOUD_POLL_MS);
    };

    void tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [opts.active, model]);

  return state;
}
