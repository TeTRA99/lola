// Route decision types for the Ask flow. The actual classification lives in
// IntentRouter.classifyIntent — it's an LLM call that handles paraphrasing,
// not a regex. This file is only here to host the discriminated union.

export type ChitchatKind = 'thanks' | 'greeting' | 'goodbye' | 'affirm' | 'other';

export type RouteDecision =
  | { type: 'repeat' }
  | { type: 'extend' }
  | { type: 'memory'; object: string }
  // savedObject: the catalogued personal object the user referred to ("mi mate" →
  // "Mi mate"), or null. Set → route the guide to CLOUD (open-vocab + its photo);
  // null + a COCO match → on-device Geiger; null + no COCO → cloud (arbitrary).
  | { type: 'guide'; object: string; savedObject?: string | null }
  // savedObject: the display name of a catalogued personal object the question
  // is about ("mi yerba" → "Mi yerba"), or null. Set → AskService attaches that
  // object's reference photo so the model can identify/describe THE user's one.
  | { type: 'model'; needsCurrent?: boolean; savedObject?: string | null }
  | { type: 'chitchat'; kind: ChitchatKind }
  | { type: 'where_am_i' };
