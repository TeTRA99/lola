// AI-based intent classifier for the Ask flow. Replaces the brittle regex
// router with a text-only LLM call: classifies the utterance into one of
// four routes and extracts the canonical noun for memory queries.

import { chatJson } from '@/gateways/openrouter';
import * as SnapshotCache from './SnapshotCache';
import type { RouteDecision } from './UtteranceRouter';

const INTENT_SYSTEM_PROMPT = `Sos un clasificador de intenciones para una asistente de voz que ayuda a una persona mayor con baja visión. Recibís una frase en español argentino (puede tener errores de transcripción). Tenés que clasificarla en UNA de estas categorías:

- "where_am_i": el usuario pregunta EXPLÍCITAMENTE en qué cuarto/lugar está ahora — "¿dónde estoy?", "¿en qué cuarto estoy?", "¿sabés dónde estoy?", "qué cuarto es este". Es siempre del PRESENTE, requiere foto nueva. NO confundir con "¿dónde está el termo?" (eso es memory).
- "chitchat": cortesías cortas sin contenido informativo — "gracias", "hola", "buenos días", "chau", "ok", "bien". No necesita foto ni llamada al modelo. Devolvé también "chitchatKind": "thanks"|"greeting"|"goodbye"|"affirm"|"other".
- "repeat": el usuario quiere que repitas LITERAL la última descripción ("¿otra vez?", "repetí", "de nuevo").
- "extend": el usuario quiere MÁS DETALLE sobre la última escena ("contame más", "seguí", "más detalles").
- "memory": el usuario pregunta UBICACIÓN/MOMENTO de un objeto que vio antes — dónde está, dónde lo dejaste, cuándo lo viste, qué había alrededor. Es una pregunta sobre EL PASADO. Extraé el sustantivo principal en singular y sin artículo.
- "model": cualquier otra pregunta sobre el CONTENIDO visible — qué es, qué dice, qué color, qué marca, cuántas hay, cómo está, está vencido, etc.

Para "model" también tenés que decidir "needsCurrent": ¿hace falta MIRAR LA ESCENA AHORA o se puede responder con la escena que ya describió antes?
- needsCurrent=true → el usuario habla del PRESENTE: "¿qué hay enfrente mío?", "¿qué veo ahora?", "describi lo que ves", "esto que tengo en la mano", "¿qué es esto?".
- needsCurrent=false → el usuario pregunta detalle sobre algo YA DESCRIPTO o que probablemente esté en la escena que describiste recién: "qué marca son las papas que viste", "de qué color era la bolsa", "qué decía la etiqueta", "cuántas había", "qué hora tiene el celular" (si describiste un celular hace poco). El usuario puede estar en otro cuarto.

REGLA IMPORTANTE: si te paso un bloque "[CONTEXTO RECIENTE: ...]" con tu última descripción, fijate si el sustantivo que el usuario menciona aparece ahí. Si aparece, casi siempre es needsCurrent=false (está preguntando detalle sobre algo que ya describiste, no sobre la escena nueva). Solo poné needsCurrent=true si el usuario CLARAMENTE pregunta sobre el presente ("ahora", "lo que veo", "esto", "sigue ahí").

Si no hay contexto o el sustantivo no aparece en él, default a needsCurrent=true.

Respondé SOLO con un objeto JSON de esta forma exacta:
{ "intent": "chitchat" | "repeat" | "extend" | "memory" | "model" | "where_am_i", "noun": "<sustantivo o null>", "needsCurrent": true | false | null, "chitchatKind": "thanks" | "greeting" | "goodbye" | "affirm" | "other" | null }

Ejemplos:
- "¿dónde estoy?" → { "intent": "where_am_i", "noun": null, "needsCurrent": null, "chitchatKind": null }
- "sabés dónde estoy" → { "intent": "where_am_i", "noun": null, "needsCurrent": null, "chitchatKind": null }
- "en qué cuarto estoy" → { "intent": "where_am_i", "noun": null, "needsCurrent": null, "chitchatKind": null }
- "qué cuarto es este" → { "intent": "where_am_i", "noun": null, "needsCurrent": null, "chitchatKind": null }
- "gracias" → { "intent": "chitchat", "noun": null, "needsCurrent": null, "chitchatKind": "thanks" }
- "muchas gracias Lola" → { "intent": "chitchat", "noun": null, "needsCurrent": null, "chitchatKind": "thanks" }
- "hola" → { "intent": "chitchat", "noun": null, "needsCurrent": null, "chitchatKind": "greeting" }
- "chau Lola" → { "intent": "chitchat", "noun": null, "needsCurrent": null, "chitchatKind": "goodbye" }
- "ok" → { "intent": "chitchat", "noun": null, "needsCurrent": null, "chitchatKind": "affirm" }
- "¿qué es esto?" → { "intent": "model", "noun": null, "needsCurrent": true, "chitchatKind": null }
- "describi lo que ves" → { "intent": "model", "noun": null, "needsCurrent": true, "chitchatKind": null }
- "Lola, otra vez" → { "intent": "repeat", "noun": null, "needsCurrent": null, "chitchatKind": null }
- "contame más sobre esto" → { "intent": "extend", "noun": null, "needsCurrent": null, "chitchatKind": null }
- "¿dónde está el termo?" → { "intent": "memory", "noun": "termo", "needsCurrent": null, "chitchatKind": null }
- "qué había cerca del termo" → { "intent": "memory", "noun": "termo", "needsCurrent": null, "chitchatKind": null }
- "sabés de qué marca son las papas" → { "intent": "model", "noun": null, "needsCurrent": false, "chitchatKind": null }
- "de qué color era la bolsa" → { "intent": "model", "noun": null, "needsCurrent": false, "chitchatKind": null }
- "qué dice la etiqueta de las papas" → { "intent": "model", "noun": null, "needsCurrent": false, "chitchatKind": null }
- "cuántas papas hay en la bolsa" → { "intent": "model", "noun": null, "needsCurrent": false, "chitchatKind": null }
- "estoy buscando unas papas" → { "intent": "memory", "noun": "papas", "needsCurrent": null, "chitchatKind": null }`;

type IntentRaw = {
  intent?: string;
  noun?: string | null;
  needsCurrent?: boolean | null;
  chitchatKind?: string | null;
};

const VALID_CHITCHAT_KINDS = ['thanks', 'greeting', 'goodbye', 'affirm', 'other'] as const;

export async function classifyIntent(utterance: string): Promise<RouteDecision> {
  console.log('[intent] classifying:', utterance);
  // Inject the last describe/ask narration as recent context so needsCurrent
  // can be decided with knowledge of what was already in the scene.
  const latest = SnapshotCache.getLatest();
  const contextBlock = latest?.narration
    ? `\n\n[CONTEXTO RECIENTE: hace unos segundos describiste: "${latest.narration}"]`
    : '';
  const resp = await chatJson<IntentRaw>({
    systemPrompt: INTENT_SYSTEM_PROMPT,
    userText: utterance + contextBlock,
  });
  if (!resp.ok) {
    console.log('[intent] classifier FAILED with:', resp.error, '— defaulting to model route');
    // Safe fallback: treat as a general question. Worst case: dad gets a
    // current-scene answer instead of a memory recall — better than nothing.
    return { type: 'model' };
  }
  const raw = resp.value;
  const intent = typeof raw.intent === 'string' ? raw.intent : null;
  const needsCurrent = raw.needsCurrent === true;
  console.log('[intent] classified as:', intent, 'noun:', raw.noun, 'needsCurrent:', needsCurrent, 'chitchatKind:', raw.chitchatKind);

  switch (intent) {
    case 'where_am_i':
      return { type: 'where_am_i' };
    case 'chitchat': {
      const kind = (VALID_CHITCHAT_KINDS as readonly string[]).includes(raw.chitchatKind ?? '')
        ? (raw.chitchatKind as 'thanks' | 'greeting' | 'goodbye' | 'affirm' | 'other')
        : 'other';
      return { type: 'chitchat', kind };
    }
    case 'repeat':
      return { type: 'repeat' };
    case 'extend':
      return { type: 'extend' };
    case 'memory':
      if (typeof raw.noun === 'string' && raw.noun.trim()) {
        return { type: 'memory', object: raw.noun.trim() };
      }
      return { type: 'model', needsCurrent };
    case 'model':
    default:
      return { type: 'model', needsCurrent };
  }
}
