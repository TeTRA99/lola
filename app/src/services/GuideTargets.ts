// feat/guide-me-to-it — resolve the object the user wants to be guided to into a
// COCO label the on-device detector knows.
//
// Per product rule: understanding the user's words is done by the LLM, NOT regex
// or a synonym dictionary. We hand the LLM the detectable set (with Spanish
// hints) and let it pick the best match, or null. We only *validate* the label
// it returns against our set (a guard on model output, not user-speech matching).

import { chatJson } from '@/gateways/openrouter';
import { GUIDABLE_COCO_LABELS } from '@/adapters/objectDetection';

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
  'cell phone': 'celular, teléfono, móvil',
  remote: 'control remoto, control, mando',
  laptop: 'notebook, laptop, computadora portátil',
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

Dada la cosa que el usuario pidió (puede tener errores de transcripción, artículos, adjetivos o posesivos), devolvé la ETIQUETA EN INGLÉS de la lista que mejor corresponde semánticamente. Si lo que pidió NO corresponde a ningún objeto de la lista, devolvé null (no inventes).

Respondé SOLO con JSON de esta forma exacta:
{ "label": "<una etiqueta EXACTA de la lista>" | null }

Ejemplos:
- "el control de la tele" → { "label": "remote" }
- "mi celular" → { "label": "cell phone" }
- "una taza" → { "label": "cup" }
- "el sillón" → { "label": "couch" }
- "la heladera" → { "label": "refrigerator" }
- "el lápiz" → { "label": null }
- "las llaves" → { "label": null }
- "mis anteojos" → { "label": null }`;
}

const RESOLVE_PROMPT = buildResolvePrompt();

export type GuideTarget = {
  /** COCO label for the detector (e.g. 'cup'). */
  cocoLabel: string;
  /** What the user called it, to say back (e.g. 'el control'). */
  spoken: string;
};

/**
 * Resolve what the user asked for into a guidable COCO target via the LLM, or
 * null if it isn't something we can detect (→ graceful "no puedo guiarte a eso").
 */
export async function resolveGuideTarget(noun: string | null | undefined): Promise<GuideTarget | null> {
  const spoken = (noun ?? '').trim();
  if (!spoken) return null;

  const resp = await chatJson<{ label?: string | null }>({
    systemPrompt: RESOLVE_PROMPT,
    userText: spoken,
  });
  if (!resp.ok) return null;

  const label = resp.value.label;
  // Guard: accept only a label actually in our detectable set.
  if (typeof label === 'string' && GUIDABLE_SET.has(label)) {
    return { cocoLabel: label, spoken };
  }
  return null;
}
