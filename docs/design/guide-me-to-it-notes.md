# "Guide me to it" — feature & implementation notes

**Status (2026-05-29):** Pre-implementation. Branch `feat/guide-me-to-it`
(off `feat/v1.1-room-recognition`, to inherit the on-device ExecuTorch/CLIP infra).
No code yet — this doc captures the interaction design, a current-as-of-today
stack sweep, and detection learnings borrowed from a sister YOLO/soccer project.

## Decisions (2026-05-29)
- **Scope: common-objects v1.** Ship against stock **YOLO26n / COCO-80** first
  (cup, bottle, book, remote, chair, laptop, tv, couch…). No training. Arbitrary /
  open-vocab objects (e.g. "pencil") deferred to a later track. "Guide me to it" is
  only offered when the named object is a COCO class the on-device model can track.
- **Camera: VisionCamera v5.** Adopt `react-native-vision-camera` v5 for the live
  `runOnFrame` loop (smooth high-fps) rather than polling expo-camera.
  - **New deps:** `react-native-vision-camera`, `react-native-nitro-modules`,
    `react-native-nitro-image`; **frame processors also need** `react-native-worklets`
    (SWM — Expo SDK 56 already aligns on it) + `react-native-vision-camera-worklets`.
  - **Native rebuild required:** config via `app.json` plugin → `npx expo prebuild`
    → `expo run:ios|android`. **Not Expo Go** — but we already ship `expo-dev-client`,
    so this fits. Fold the **Expo 56.0.5→56.0.8** patch bump into this rebuild.
  - **Permissions:** iOS `NSCameraUsageDescription`; Android `CAMERA` (already have
    camera perms via expo-camera).
  - **Coexistence:** `expo-camera` still powers Describe/Ask capture + snapshots
    (CapturePhotoModal, CameraHost). VisionCamera is added *for the guide loop only*;
    two camera libs can't hold the device simultaneously, so ensure only one is
    mounted/active at a time (tear down the expo-camera view before opening the
    VisionCamera guide screen).

## The interaction
After a Describe/Ask names something ("there's a yellow pencil on the table"),
the user says **"guide me to it"**. Open a live camera feed, locate that object
each frame, and drive a **continuous haptic that strengthens as the camera centers
on it and fades as you pan away** — a "hot/cold" homing loop. Lock = sustained buzz
(+ short audio cue).

**Why this fits phone hardware** (unlike the earlier directional idea — see
[directional-haptics-notes.md](./directional-haptics-notes.md)): it needs only
**one dimension** (aligned ↔ not), which a single vibration motor renders well.
The *user* does the spatial scanning by moving the phone; the phone only answers
"warmer/colder." We turned the hard problem (2-D direction, impossible on one
motor) into the easy one.

## Haptic model
- **Geiger-counter / pulse-rate**, not smooth amplitude fade. Android can't do
  smooth continuous amplitude (Charly's Galaxy already can't feel Light impact);
  pulse *rate* reads clearly on weak motors. Faster pulses near center → solid
  buzz on lock.
- **Library:** evaluate **Pulsar** (`react-native-pulsar` v1.5.0, Software Mansion)
  — its `useRealtimeComposer` hook is built for exactly this (live amplitude/
  frequency during a gesture). Needs New Arch (we're on it), Expo prebuild OK.
  Note Pulsar itself simulates Android "frequency" via tick timing — confirms the
  rate-based approach. Keep existing `react-native-haptic-feedback@3.0.0` (fine,
  maintained, no deprecations) for the discrete taps already in haptics.ts.

## Stack sweep — current as of 2026-05-29 (verified online, not recalled)
- **ExecuTorch:** on `0.9.0` = **latest stable** (published 2026-05-25; `0.10.0`
  only in nightly). **No upgrade needed to start.** 0.9.0 raised the **iOS
  deployment target to 17.0** — our iOS floor.
  - Relevant 0.8–0.9 additions: **`runOnFrame` real-time frame processing via
    VisionCamera v5**; **YOLO26 support** (pose) + **YOLO-variant** instance
    segmentation; **custom-model object detection**; **FastSAM with point/box/
    *text* prompts** (an on-device open-vocab-ish localizer: "pencil" → mask →
    centroid; heavier than a detector — needs a perf spike).
- **Camera pipeline — DECIDED: VisionCamera v5** (see Decisions block above).
  `5.0.10`, Nitro Modules, uses `react-native-worklets` which Expo SDK 56 aligned
  on → smooth high-fps `runOnFrame` loop.
- **Expo:** on `~56.0.5`; latest patch is **56.0.8** — safe bump, fold into the
  dev-client rebuild we'll need anyway.

## Detection plan — learnings from the sister YOLO project (reconciled to our stack)
**Transfers directly:**
- **Stock pretrained YOLO26n, likely no training.** Common household objects (cup,
  bottle, book, remote, chair, laptop, tv, couch…) are COCO classes → detected out
  of the box. Only fine-tune if a *specific* object underperforms (their fine-tune
  plateaued at ~372 images — sharply diminishing returns).
- **Size = nano (`n`) always.** On a low-end phone it's the only viable tier, not a
  compromise.
- **YOLO26n over YOLO11n:** ~15% higher FPS + higher mAP at 640 on edge proxies,
  and YOLO26 dropped DFL/built-in NMS → fewer custom ops → **converts far more
  cleanly to mobile runtimes**.
- **`imgsz` is the master speed/accuracy dial.** Start 640, then try **320/416** on
  the phone — large in-frame household objects lose little accuracy, gain lots of
  FPS. First knob before anything fancy.
- **INT8 quantization** is the key lever for a low-end phone, BUT needs a **small
  representative calibration set** (real frames from *his* rooms/camera) or accuracy
  drops. **Re-validate mAP after quantizing.**
- **Detection ≠ tracking.** Per-frame YOLO boxes flicker / lose IDs. Add a cheap
  **ByteTrack** layer (Ultralytics `model.track()`) for stable per-object IDs —
  this is the "follow *this* cup" layer, not a bigger model.
- If we ever fine-tune: **match inference imgsz to training imgsz** (sister project
  lost accuracy + had to retrain otherwise).

**Diverges for us — runtime:** sister project exported to **NCNN/CoreML/TFLite**
because they had *no* on-device runtime. **We already run ExecuTorch** (CLIP today),
and 0.9.0 supports YOLO26 + custom-model detection + the real-time path. So prefer
**YOLO26n → ExecuTorch `.pte` (INT8)**, reusing one runtime. **NCNN (Android) /
CoreML (iOS) / TFLite is the fallback** if YOLO26n *detection* doesn't export
cleanly to `.pte`. → **Spike: confirm clean `.pte` export of YOLO26n detection.**

**Gap the sister TL;DR doesn't cover:** their targets were COCO classes. For Lola,
arbitrary described objects (e.g. "pencil") are **not** in COCO. So:
- **Common-objects v1** → stock YOLO26n/COCO (low risk, current stack).
- **Arbitrary-object track** → open-vocab (YOLO-World / YOLOE26 "prompt-then-detect",
  or FastSAM text-prompt) — separate, riskier R&D; needs conversion + on-device fps
  spike on the Galaxy.
- Bridge: Describe already names what it saw → only offer "guide me to it" when the
  named object is one the on-device model can actually track.

**Ignore from the sister project** (soccer/accessibility-specific): SAM / SAM 3.1
(batch-only, H100-class, cloud — wrong tool for live anything), ByteTrack params
tuned for a fast tiny ball, HDMI capture-card rig, kinematic extrapolation/overlay
fade. **Tooling note for any training/export box:** install latest stable (not
README minimums); use **Python 3.12, not 3.13** (torch 3.13 parse bugs).

## Suggested spikes (make-or-break first)
1. **Detection on-device:** YOLO26n (COCO) via ExecuTorch on the *actual Galaxy* —
   measure fps + accuracy at imgsz 320/416/640. Also resolve `.pte` export.
2. **Haptic loop (no camera):** Pulsar `useRealtimeComposer` Geiger-counter — confirm
   he can home in on a moving "hot" target by feel alone.
3. **Then decide scope** (common-objects v1 vs open-vocab track) and **camera path**
   (VisionCamera v5 vs expo-camera polling).

## Sources
- [ExecuTorch releases](https://github.com/software-mansion/react-native-executorch/releases)
- [Pulsar RN docs](https://docs.swmansion.com/pulsar/sdk/react-native/)
- [VisionCamera v5 frame processors](https://react-native-vision-camera.com/docs/guides/frame-processors)
- [YOLOE / open-vocab (Ultralytics)](https://docs.ultralytics.com/models/yoloe)
- [Ultralytics export modes & quantization](https://docs.ultralytics.com/modes/export/)
- Sister-project YOLO/soccer learnings (internal handoff, 2026-05-29)
