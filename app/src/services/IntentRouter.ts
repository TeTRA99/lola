// AI-based intent classifier for the Ask flow. Replaces the brittle regex
// router with a text-only LLM call: classifies the utterance into one of
// four routes and extracts the canonical noun for memory queries.

import { chatJson } from '@/services/ModelRouter';
import * as SnapshotCache from './SnapshotCache';
import type { RouteDecision } from './UtteranceRouter';
import { CONFIG } from '@/config';

const INTENT_SYSTEM_PROMPT = `Sos un clasificador de intenciones para una asistente de voz que ayuda a una persona mayor con baja visión. Recibís una frase en español argentino (puede tener errores de transcripción). Tenés que clasificarla en UNA de estas categorías:

- "where_am_i": el usuario pregunta EXPLÍCITAMENTE en qué cuarto/lugar está ahora — "¿dónde estoy?", "¿en qué cuarto estoy?", "¿sabés dónde estoy?", "qué cuarto es este". Es siempre del PRESENTE, requiere foto nueva. NO confundir con "¿dónde está el termo?" (eso es memory).
- "chitchat": cortesías cortas sin contenido informativo — "gracias", "hola", "buenos días", "chau", "ok", "bien". No necesita foto ni llamada al modelo. Devolvé también "chitchatKind": "thanks"|"greeting"|"goodbye"|"affirm"|"other".
- "repeat": el usuario quiere que repitas LITERAL la última descripción ("¿otra vez?", "repetí", "de nuevo").
- "extend": el usuario quiere MÁS DETALLE sobre la última escena ("contame más", "seguí", "más detalles").
- "memory": el usuario pregunta por lo que VIO ANTES y NO pide que lo guíes hasta el objeto ahora — dónde ESTABA, dónde lo DEJÓ, CUÁNDO lo vio, qué había alrededor. Es RECUERDO del PASADO ("¿dónde dejé las llaves?", "¿cuándo viste el termo?", "¿qué había cerca del vaso?"). Extraé el sustantivo principal en singular y sin artículo.
- "guide": el usuario PIDE AYUDA para ENCONTRAR, UBICAR o LLEGAR a un objeto que podría estar en el lugar AHORA, y querés guiarlo con la cámara — "llevame a la taza", "guiame hasta el control", "ayudame a encontrar mi botella", "¿me ayudás a buscar el vaso?", "no encuentro el control, ¿me ayudás?", "ayudame a llegar al sillón". Es del PRESENTE: quiere encontrarlo o llegar AHORA. Extraé el sustantivo principal en "noun" (singular, sin artículo). DISTINCIÓN CLAVE con "memory": si PIDE AYUDA para encontrarlo/llegar ahora → "guide"; si sólo pregunta dónde estaba o cuándo lo viste (recuerdo) → "memory".
- "call_family": el usuario quiere LLAMAR o ESCRIBIR a un familiar/persona de confianza, o PIDE AYUDA. Extraé el nombre en "noun" si lo dice ("Charly", "mi hijo", "mi hija"); si solo dice "ayuda"/"necesito ayuda"/"emergencia" sin nombre, noun = null. Además decidí "channel": "whatsapp" SOLO si pide explícitamente un WhatsApp o un mensaje escrito ("mandale un WhatsApp", "escribile", "mandale un mensaje"); en cualquier otro caso (incluida toda pedida de ayuda/emergencia), channel = "call". Si el usuario DICTA el contenido del mensaje (sobre todo para WhatsApp), redactá en "message" un mensaje NATURAL, completo y bien escrito, como si la persona se lo mandara al destinatario — NO copies literal lo que dicta, interpretá la intención y armá la frase. Usá español argentino con VOSEO (vení, podés, venís, decime, mandame — NUNCA "ven", "puedes", "vienes"). Podés empezar con un saludo corto ("Hola, "). Ejemplos: "que estoy bien" → "Hola, estoy bien."; "que llego tarde" → "Hola, llego un poco tarde."; "que venga hoy" → "Hola, ¿podés venir hoy?"; "preguntale si viene a cenar" → "Hola, ¿venís a cenar?"; "decile que lo quiero" → "Hola, te quiero mucho.". Si no dicta contenido, message = null.
- "model": cualquier otra pregunta sobre el CONTENIDO visible — qué es, qué dice, qué color, qué marca, cuántas hay, cómo está, está vencido, etc.

Para "model" también tenés que decidir "needsCurrent": ¿hace falta MIRAR LA ESCENA AHORA o se puede responder con la escena que ya describió antes?
- needsCurrent=true → el usuario habla del PRESENTE: "¿qué hay enfrente mío?", "¿qué veo ahora?", "describi lo que ves", "esto que tengo en la mano", "¿qué es esto?".
- needsCurrent=false → el usuario pregunta detalle sobre algo YA DESCRIPTO o que probablemente esté en la escena que describiste recién: "qué marca son las papas que viste", "de qué color era la bolsa", "qué decía la etiqueta", "cuántas había", "qué hora tiene el celular" (si describiste un celular hace poco). El usuario puede estar en otro cuarto.

REGLA IMPORTANTE: si te paso un bloque "[CONTEXTO RECIENTE: ...]" con tu última descripción, fijate si el sustantivo que el usuario menciona aparece ahí. Si aparece, casi siempre es needsCurrent=false (está preguntando detalle sobre algo que ya describiste, no sobre la escena nueva). Solo poné needsCurrent=true si el usuario CLARAMENTE pregunta sobre el presente ("ahora", "lo que veo", "esto", "sigue ahí").

Si no hay contexto o el sustantivo no aparece en él, default a needsCurrent=true.

OBJETOS GUARDADOS: si te paso un bloque "[OBJETOS GUARDADOS: ...]" y el usuario se refiere a uno de ELLOS como suyo (con posesivo "mi/mis/la mía/el mío", o por su nombre), poné el NOMBRE EXACTO de esa lista en "savedObject". Sirve tanto para describirlo ("describime mi yerba") como para distinguirlo entre varios ("¿cuál de estas es mi yerba?"). Si no se refiere a ninguno de la lista, savedObject = null.

CONTACTOS GUARDADOS: si te paso un bloque "[CONTACTOS GUARDADOS: ...]" y la intención es "call_family" con un nombre, poné en "noun" el NOMBRE EXACTO de esa lista que mejor coincida con lo que el usuario dijo. La transcripción de nombres suele venir con errores o partida en pedazos (un nombre como "Zoomy" puede llegar como "sumi", "su mi", "zumi", "tsunami"): elegí el contacto que SUENE más parecido. Solo si NINGUNO suena razonablemente parecido, poné en "noun" lo que escuchaste tal cual. Para "ayuda"/"emergencia" sin nombre, noun = null.

Respondé SOLO con un objeto JSON de esta forma exacta:
{ "intent": "chitchat" | "repeat" | "extend" | "memory" | "guide" | "model" | "where_am_i" | "call_family", "noun": "<sustantivo o null>", "needsCurrent": true | false | null, "chitchatKind": "thanks" | "greeting" | "goodbye" | "affirm" | "other" | null, "savedObject": "<nombre exacto de la lista de objetos guardados o null>", "channel": "call" | "whatsapp" | null, "message": "<texto del mensaje a enviar, en primera persona, o null>" }

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
- "llevame a la taza" → { "intent": "guide", "noun": "taza", "needsCurrent": null, "chitchatKind": null }
- "guiame hasta el control" → { "intent": "guide", "noun": "control", "needsCurrent": null, "chitchatKind": null }
- "ayudame a llegar al sillón" → { "intent": "guide", "noun": "sillón", "needsCurrent": null, "chitchatKind": null }
- "¿me ayudás a encontrar mi botella?" → { "intent": "guide", "noun": "botella", "needsCurrent": null, "chitchatKind": null }
- "ayudame a buscar el control" → { "intent": "guide", "noun": "control", "needsCurrent": null, "chitchatKind": null }
- "no encuentro el vaso, ¿me ayudás?" → { "intent": "guide", "noun": "vaso", "needsCurrent": null, "chitchatKind": null }
- "¿dónde dejé las llaves?" → { "intent": "memory", "noun": "llaves", "needsCurrent": null, "chitchatKind": null }
- "qué había cerca del termo" → { "intent": "memory", "noun": "termo", "needsCurrent": null, "chitchatKind": null }
- "sabés de qué marca son las papas" → { "intent": "model", "noun": null, "needsCurrent": false, "chitchatKind": null }
- "de qué color era la bolsa" → { "intent": "model", "noun": null, "needsCurrent": false, "chitchatKind": null }
- "qué dice la etiqueta de las papas" → { "intent": "model", "noun": null, "needsCurrent": false, "chitchatKind": null }
- "cuántas papas hay en la bolsa" → { "intent": "model", "noun": null, "needsCurrent": false, "chitchatKind": null }
- "estoy buscando unas papas" → { "intent": "memory", "noun": "papas", "needsCurrent": null, "chitchatKind": null }
- (con [OBJETOS GUARDADOS: Mi yerba]) "¿cuál de estas es mi yerba?" → { "intent": "model", "noun": "yerba", "needsCurrent": true, "chitchatKind": null, "savedObject": "Mi yerba" }
- (con [OBJETOS GUARDADOS: Mi yerba]) "describime mi yerba" → { "intent": "model", "noun": "yerba", "needsCurrent": true, "chitchatKind": null, "savedObject": "Mi yerba" }
- (con [OBJETOS GUARDADOS: Mi mate]) "guiame a mi mate" → { "intent": "guide", "noun": "mate", "needsCurrent": null, "chitchatKind": null, "savedObject": "Mi mate" }
- (con [OBJETOS GUARDADOS: Mi mate]) "guiame a una taza" → { "intent": "guide", "noun": "taza", "needsCurrent": null, "chitchatKind": null, "savedObject": null }
- "llamá a Charly" → { "intent": "call_family", "noun": "Charly", "needsCurrent": null, "chitchatKind": null, "channel": "call" }
- "llamá a mi hijo" → { "intent": "call_family", "noun": "mi hijo", "needsCurrent": null, "chitchatKind": null, "channel": "call" }
- "necesito ayuda" → { "intent": "call_family", "noun": null, "needsCurrent": null, "chitchatKind": null, "channel": "call" }
- "emergencia" → { "intent": "call_family", "noun": null, "needsCurrent": null, "chitchatKind": null, "channel": "call" }
- "mandale un WhatsApp a Charly" → { "intent": "call_family", "noun": "Charly", "needsCurrent": null, "chitchatKind": null, "channel": "whatsapp" }
- "escribile a mi hija" → { "intent": "call_family", "noun": "mi hija", "needsCurrent": null, "chitchatKind": null, "channel": "whatsapp" }
- (con [CONTACTOS GUARDADOS: Zoomy]) "llamá a sumi" → { "intent": "call_family", "noun": "Zoomy", "needsCurrent": null, "chitchatKind": null, "channel": "call" }
- (con [CONTACTOS GUARDADOS: Zoomy, Mariana]) "hablar con su mi" → { "intent": "call_family", "noun": "Zoomy", "needsCurrent": null, "chitchatKind": null, "channel": "call" }
- (con [CONTACTOS GUARDADOS: Zoomy]) "llamá a Pedro" → { "intent": "call_family", "noun": "Pedro", "needsCurrent": null, "chitchatKind": null, "channel": "call" }
- (con [CONTACTOS GUARDADOS: Zoomy]) "escribile a Zoomy que estoy bien" → { "intent": "call_family", "noun": "Zoomy", "needsCurrent": null, "chitchatKind": null, "channel": "whatsapp", "message": "Hola, estoy bien." }
- (con [CONTACTOS GUARDADOS: Zoomy]) "mandale un mensaje a Zoomy que venga hoy" → { "intent": "call_family", "noun": "Zoomy", "needsCurrent": null, "chitchatKind": null, "channel": "whatsapp", "message": "Hola, ¿podés venir hoy?" }
- "mandale un WhatsApp a mi hija diciendo que la llamo más tarde" → { "intent": "call_family", "noun": "mi hija", "needsCurrent": null, "chitchatKind": null, "channel": "whatsapp", "message": "Hola, te llamo más tarde." }`;

type IntentRaw = {
  intent?: string;
  noun?: string | null;
  needsCurrent?: boolean | null;
  chitchatKind?: string | null;
  savedObject?: string | null;
  channel?: string | null;
  message?: string | null;
};

const VALID_CHITCHAT_KINDS = ['thanks', 'greeting', 'goodbye', 'affirm', 'other'] as const;

export async function classifyIntent(
  utterance: string,
  catalogNames: string[] = [],
  contactNames: string[] = [],
  // Model override for the eval harness (MODEL=… npm run eval); the app never
  // sets it, so production keeps using the ModelRouter/CONFIG default.
  model?: string,
): Promise<RouteDecision> {
  console.log('[intent] classifying:', utterance);
  // Inject the last describe/ask narration as recent context so needsCurrent
  // can be decided with knowledge of what was already in the scene.
  const latest = SnapshotCache.getLatest();
  const contextBlock = latest?.narration
    ? `\n\n[CONTEXTO RECIENTE: hace unos segundos describiste: "${latest.narration}"]`
    : '';
  // The user's saved objects, so the LLM can flag when a question is about one
  // of THEM ("mi yerba") — drives reference-photo attachment downstream.
  const savedBlock = catalogNames.length
    ? `\n\n[OBJETOS GUARDADOS: ${catalogNames.join(', ')}]`
    : '';
  // The user's saved family contacts, so the LLM can map a (possibly badly
  // transcribed) spoken name to the right contact — names like "Zoomy" come back
  // from es-AR STT mangled ("sumi"/"su mi"), so exact matching downstream fails.
  const contactBlock = contactNames.length
    ? `\n\n[CONTACTOS GUARDADOS: ${contactNames.join(', ')}]`
    : '';
  // Text-only classification runs on the cheap model: the 2026-06-10 eval
  // scorecards put flash-lite at parity with flash on this prompt and ~40%
  // faster (p50 0.9s vs 1.4s) — it's on the critical path of every Ask.
  // See docs/design/evaluation.md.
  const resp = await chatJson<IntentRaw>({
    systemPrompt: INTENT_SYSTEM_PROMPT,
    userText: utterance + contextBlock + savedBlock + contactBlock,
    model: model ?? CONFIG.MODEL_ID_CHEAP,
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
  // Accept savedObject only if it's actually one of the catalog names (guard the
  // model output): match case-insensitively, return the canonical catalog spelling.
  const savedObject =
    typeof raw.savedObject === 'string' && raw.savedObject.trim()
      ? catalogNames.find(n => n.toLowerCase() === raw.savedObject!.trim().toLowerCase()) ?? null
      : null;
  console.log('[intent] classified as:', intent, 'noun:', raw.noun, 'needsCurrent:', needsCurrent, 'savedObject:', savedObject);

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
      return { type: 'model', needsCurrent, savedObject };
    case 'guide':
      if (typeof raw.noun === 'string' && raw.noun.trim()) {
        return { type: 'guide', object: raw.noun.trim(), savedObject };
      }
      return { type: 'model', needsCurrent, savedObject };
    case 'call_family':
      return {
        type: 'call_family',
        contactName: typeof raw.noun === 'string' && raw.noun.trim() ? raw.noun.trim() : null,
        channel: raw.channel === 'whatsapp' ? 'whatsapp' : 'call',
        message: typeof raw.message === 'string' && raw.message.trim() ? raw.message.trim() : null,
      };
    case 'model':
    default:
      return { type: 'model', needsCurrent, savedObject };
  }
}
