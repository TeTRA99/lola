// feat/guide-me-to-it — resolve the object the user wants to be guided to into a
// COCO label the on-device detector knows.
//
// Per product rule: understanding the user's words is done by the LLM, NOT regex
// or a synonym dictionary. We hand the LLM the detectable set (with Spanish
// hints) and let it pick the best match, or null. We only *validate* the label
// it returns against our set (a guard on model output, not user-speech matching).

import { chatJson } from '@/services/ModelRouter';
import { GUIDABLE_COCO_LABELS } from '@/adapters/objectDetection';
import { CONFIG } from '@/config';

// Spanish hints per label — reference DATA to ground the LLM + document the set.
// NOT an utterance matcher.
const GUIDABLE_ES: Record<string, string> = {
  cup: 'taza, vaso, pocillo, jarro',
  bottle: 'botella',
  bowl: 'bol, tazón, cuenco, ensaladera',
  'wine glass': 'copa',
  fork: 'tenedor',
  knife: 'cuchillo',
  spoon: 'cuchara, cucharita',
  'cell phone': 'celular, celu, teléfono, móvil',
  remote: 'control remoto, control, mando',
  laptop: 'notebook, laptop, compu, computadora portátil',
  keyboard: 'teclado',
  mouse: 'mouse, ratón',
  book: 'libro, cuaderno',
  scissors: 'tijera, tijeras',
  clock: 'reloj de pared',
  vase: 'florero, jarrón',
  backpack: 'mochila',
  handbag: 'cartera, bolso',
  'sports ball': 'pelota, balón',
  chair: 'silla',
  couch: 'sillón, sofá',
  'dining table': 'mesa, mesa del comedor',
  bed: 'cama',
  toilet: 'inodoro',
  refrigerator: 'heladera, refrigerador, nevera',
  tv: 'televisor, tele, televisión',
};

const GUIDABLE_SET = new Set(GUIDABLE_COCO_LABELS as readonly string[]);

function buildResolvePrompt(): string {
  const lines = (GUIDABLE_COCO_LABELS as readonly string[])
    .map(l => `- ${l}: ${GUIDABLE_ES[l] ?? l}`)
    .join('\n');
  return `Sos parte de Lola, una asistente de voz para una persona mayor con baja visión que habla español argentino. El usuario quiere que lo guiemos físicamente hacia un objeto usando la cámara. Sólo podemos detectar los objetos de esta lista.

Lista de objetos detectables (etiqueta en inglés: cómo se dicen en español):
${lines}

Dada la cosa que el usuario pidió (puede tener errores de transcripción, artículos, adjetivos o posesivos), elegí la ETIQUETA EN INGLÉS de la lista que mejor corresponde, e indicá qué tan bien encaja:
- "exact": lo que pidió ES uno de los objetos de la lista (es esa misma cosa).
- "approx": lo que pidió NO está en la lista, pero el objeto elegido es el más parecido físicamente (forma y tamaño) y sirve como aproximación razonable para guiar (ej.: un termo se parece a una botella).
Si no hay ningún objeto de la lista que sirva ni siquiera como aproximación, devolvé label null.

Incluí también "spoken": una forma natural y breve de nombrar lo que pidió el usuario para decírselo en voz alta, SIEMPRE con su artículo correcto ("el termo", "la taza", "el control"). No lo dejes sin artículo.

Respondé SOLO con JSON de esta forma exacta:
{ "label": "<una etiqueta EXACTA de la lista>" | null, "match": "exact" | "approx", "spoken": "<forma natural con artículo>" }

Ejemplos:
- "el control de la tele" → { "label": "remote", "match": "exact", "spoken": "el control" }
- "mi celular" → { "label": "cell phone", "match": "exact", "spoken": "tu celular" }
- "una taza" → { "label": "cup", "match": "exact", "spoken": "la taza" }
- "el sillón" → { "label": "couch", "match": "exact", "spoken": "el sillón" }
- "la heladera" → { "label": "refrigerator", "match": "exact", "spoken": "la heladera" }
- "el termo" → { "label": "bottle", "match": "approx", "spoken": "el termo" }
- "el mate" → { "label": "cup", "match": "approx", "spoken": "el mate" }
- "el lápiz" → { "label": null, "match": "exact", "spoken": "el lápiz" }
- "las llaves" → { "label": null, "match": "exact", "spoken": "las llaves" }
- "mis anteojos" → { "label": null, "match": "exact", "spoken": "tus anteojos" }`;
}

const RESOLVE_PROMPT = buildResolvePrompt();

export type GuideTarget = {
  /** COCO label for the detector (e.g. 'cup'). */
  cocoLabel: string;
  /** What the user called it, to say back (e.g. 'el control'). */
  spoken: string;
  /** True when the requested thing isn't itself a detectable class but was
   *  mapped to the closest proxy (e.g. "termo" → bottle) — caller should warn
   *  the user it's not fully supported before guiding. */
  approximate?: boolean;
};

/**
 * Resolve what the user asked for into a guidable COCO target via the LLM, or
 * null if it isn't something we can detect (→ graceful "no puedo guiarte a eso").
 * `approximate` is set when the match is only a physical proxy, not the real class.
 */
export async function resolveGuideTarget(
  noun: string | null | undefined,
  // Model override for the eval harness only — the app never sets it.
  model?: string,
): Promise<GuideTarget | null> {
  const spoken = (noun ?? '').trim();
  if (!spoken) return null;

  // Cheap model by default: the 2026-06-10 eval scorecards had flash-lite at
  // 23/23 on this prompt (flash flaked on an anchor) and ~2× faster.
  // See docs/design/evaluation.md.
  const resp = await chatJson<{ label?: string | null; match?: string; spoken?: string }>({
    systemPrompt: RESOLVE_PROMPT,
    userText: spoken,
    model: model ?? CONFIG.MODEL_ID_CHEAP,
  });
  if (!resp.ok) return null;

  const label = resp.value.label;
  // Guard: accept only a label actually in our detectable set.
  if (typeof label === 'string' && GUIDABLE_SET.has(label)) {
    // Speak the natural phrase (with article) the model returned; fall back to
    // the bare noun if it didn't give one, so we never crash on a missing field.
    const saidAs = typeof resp.value.spoken === 'string' && resp.value.spoken.trim()
      ? resp.value.spoken.trim()
      : spoken;
    // Default to exact unless the model explicitly flags an approximation, so we
    // never warn on a legitimate object.
    return resp.value.match === 'approx'
      ? { cocoLabel: label, spoken: saidAs, approximate: true }
      : { cocoLabel: label, spoken: saidAs };
  }
  return null;
}
