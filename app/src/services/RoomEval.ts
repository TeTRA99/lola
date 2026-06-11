// Orchestration for the Debug room-ID eval (Charly-only). Feeds real catalog
// data / the real CLIP pipeline into the pure scoring core (roomEvalCore).
//
// Two passes, both free (local inference only):
//   leave-one-out — instant, reuses stored embeddings; catches cross-room
//     confusion but overstates accuracy (same-session photos).
//   holdout — bundled photos (src/eval/roomEvalAssets.ts) through the REAL
//     identifyRoom() incl. CLIP inference; `expected: null` must abstain.

import { Asset } from 'expo-asset';
import { listRooms, listPhotosForRoom, identifyRoom, SIMILARITY_THRESHOLD } from './RoomCatalog';
import { leaveOneOutRows, type EvalRow, type LabeledEmbedding } from './roomEvalCore';
import { ROOM_EVAL_HOLDOUT } from '@/eval/roomEvalAssets';
import { ok, err, type Result } from '@/utils/result';

export { SIMILARITY_THRESHOLD };

export async function runLeaveOneOut(): Promise<Result<EvalRow[], 'too_few_photos'>> {
  const photos: LabeledEmbedding[] = [];
  for (const room of await listRooms()) {
    for (const p of await listPhotosForRoom(room.id)) {
      photos.push({ photoId: p.id, room: room.display_name, embedding: p.embedding });
    }
  }
  if (photos.length < 2) return err('too_few_photos');
  return ok(leaveOneOutRows(photos, SIMILARITY_THRESHOLD));
}

/**
 * Run the bundled holdout photos through the full identifyRoom() pipeline.
 * Returns [] when no holdout photos are bundled. Embed/storage errors count as
 * an abstain (predicted null) — same as what dad would experience.
 */
export async function runHoldout(): Promise<EvalRow[]> {
  const rows: EvalRow[] = [];
  for (let i = 0; i < ROOM_EVAL_HOLDOUT.length; i++) {
    const item = ROOM_EVAL_HOLDOUT[i];
    const asset = Asset.fromModule(item.asset);
    await asset.downloadAsync();
    if (!asset.localUri) continue;
    const r = await identifyRoom(asset.localUri);
    rows.push({
      id: `holdout-${i + 1}`,
      expected: item.expected,
      predicted: r.ok && r.value ? r.value.displayName : null,
      similarity: r.ok && r.value ? r.value.similarity : null,
    });
  }
  return rows;
}
