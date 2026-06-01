// Route decision types for the Ask flow. The actual classification lives in
// IntentRouter.classifyIntent — it's an LLM call that handles paraphrasing,
// not a regex. This file is only here to host the discriminated union.

export type ChitchatKind = 'thanks' | 'greeting' | 'goodbye' | 'affirm' | 'other';

export type RouteDecision =
  | { type: 'repeat' }
  | { type: 'extend' }
  | { type: 'memory'; object: string }
  | { type: 'guide'; object: string }
  | { type: 'model'; needsCurrent?: boolean }
  | { type: 'chitchat'; kind: ChitchatKind }
  | { type: 'where_am_i' };
