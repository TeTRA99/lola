// feat/guide-me-to-it — map a Spanish noun (from intent classification) to a
// COCO label the on-device detector knows. v1 guides only to common objects
// (COCO); anything else returns null → "no puedo guiarte a eso".
//
// The returned cocoLabel matches GUIDABLE_COCO_LABELS (lowercase); the detector
// normalizes case/separators, so it lines up with the model's UPPERCASE labels.

import { GUIDABLE_COCO_LABELS } from '@/adapters/objectDetection';

/** Normalize a noun for lookup: lowercase, strip accents/punctuation, collapse spaces. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// Spanish term (normalized — no accents, lowercase) → COCO label.
// Several synonyms/plurals can map to one label.
const ES_TO_COCO: Record<string, string> = {
  taza: 'cup', tazas: 'cup', pocillo: 'cup', vaso: 'cup', vasos: 'cup', jarro: 'cup',
  botella: 'bottle', botellas: 'bottle',
  bol: 'bowl', bowl: 'bowl', tazon: 'bowl', cuenco: 'bowl', ensaladera: 'bowl',
  silla: 'chair', sillas: 'chair',
  sillon: 'couch', sofa: 'couch',
  libro: 'book', libros: 'book', cuaderno: 'book',
  control: 'remote', 'control remoto': 'remote', remoto: 'remote', mando: 'remote',
  laptop: 'laptop', notebook: 'laptop', computadora: 'laptop', compu: 'laptop',
  portatil: 'laptop', 'computadora portatil': 'laptop',
  teclado: 'keyboard',
  mouse: 'mouse', raton: 'mouse',
  tele: 'tv', televisor: 'tv', television: 'tv', tv: 'tv', pantalla: 'tv',
  cuchara: 'spoon', cucharas: 'spoon', cucharita: 'spoon',
  cuchillo: 'knife', cuchillos: 'knife',
  tenedor: 'fork', tenedores: 'fork',
  tijera: 'scissors', tijeras: 'scissors',
  mochila: 'backpack',
  cartera: 'handbag', bolso: 'handbag', bolsa: 'handbag',
  pelota: 'sports ball', pelotas: 'sports ball', balon: 'sports ball',
  reloj: 'clock',
  florero: 'vase', jarron: 'vase',
  copa: 'wine glass', copas: 'wine glass',
  celular: 'cell phone', telefono: 'cell phone', movil: 'cell phone', smartphone: 'cell phone',
};

// Build the lookup with normalized keys so accented/multi-word keys match input.
const NORM_MAP: Record<string, string> = {};
for (const [k, v] of Object.entries(ES_TO_COCO)) NORM_MAP[normalize(k)] = v;

const GUIDABLE = new Set(GUIDABLE_COCO_LABELS as readonly string[]);

export type GuideTarget = {
  /** COCO label for the detector (e.g. 'cup'). */
  cocoLabel: string;
  /** The noun to say back to the user (e.g. 'taza'). */
  spoken: string;
};

/**
 * Resolve a Spanish noun to a guidable COCO target, or null if we can't guide
 * to it (unknown word, or not a COCO class we ship in v1). Null is the graceful
 * fallback signal — the flow says "por ahora no puedo guiarte hasta eso".
 */
export function resolveGuideTarget(noun: string | null | undefined): GuideTarget | null {
  if (!noun) return null;
  const n = normalize(noun);
  if (!n) return null;
  // Whole phrase first, then each word (e.g. "control remoto" → remote;
  // "una taza amarilla" → taza).
  const candidates = [n, ...n.split(' ')];
  for (const c of candidates) {
    const label = NORM_MAP[c];
    if (label && GUIDABLE.has(label)) {
      return { cocoLabel: label, spoken: noun.trim() };
    }
  }
  return null;
}

/** True if we can guide to this Spanish noun (for gating the offer/intent). */
export function isGuidable(noun: string | null | undefined): boolean {
  return resolveGuideTarget(noun) !== null;
}
