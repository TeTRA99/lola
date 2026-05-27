// Classifies STT output into one of four Ask-flow branches.
// Pure function — no side effects. AskService (E3.2) dispatches on this.

export type RouteDecision =
  | { type: 'repeat' }
  | { type: 'extend' }
  | { type: 'memory'; object: string }
  | { type: 'model' };

function normalize(raw: string): string {
  return raw.trim().replace(/^lola[,\s]+/i, '').trim();
}

const REPEAT_RE = /(otra vez|de nuevo|repet[ií])/i;
const EXTEND_RE = /(contame m[áa]s|segu[íi]|m[áa]s detalle)/i;
const MEMORY_RE = /¿?(d[óo]nde est[áa]|viste mi|d[óo]nde puse)\s+(.+?)\??$/i;

export function route(utterance: string): RouteDecision {
  const s = normalize(utterance);
  if (REPEAT_RE.test(s)) return { type: 'repeat' };
  if (EXTEND_RE.test(s)) return { type: 'extend' };
  const m = MEMORY_RE.exec(s);
  if (m && m[2]) {
    return { type: 'memory', object: m[2].trim().replace(/\?+$/, '').trim() };
  }
  return { type: 'model' };
}
