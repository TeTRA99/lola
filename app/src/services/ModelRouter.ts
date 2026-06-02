// Routing seam between cloud (OpenRouter) and on-device inference.
//
// The four model call sites — DescribeService, AskService, IntentRouter and
// GuideTargets — import chat()/chatJson() from here instead of the gateway
// directly. That makes "run this request on the cloud or on the device" a single
// decision in one place, driven by the `inferenceMode` setting, rather than a
// branch scattered across every caller.
//
// Vision (chat) routes to the on-device VLM when inferenceMode is 'local'.
// Text JSON (chatJson) still goes to the cloud until the on-device text-LLM
// adapter lands in a later step. The default mode is 'cloud' (config), so this
// is inert until DebugScreen flips the toggle or the migration flips the default.

import * as cloud from '@/gateways/openrouter';
import type { ChatInput, ChatError, LolaResponse } from '@/gateways/openrouter';
import * as VlmAdapter from '@/adapters/visionLLM';
import * as TextAdapter from '@/adapters/textLLM';
import { ensureResident } from '@/adapters/llmResidency';
import * as Settings from './Settings';
import { CONFIG } from '@/config';
import { type Result } from '@/utils/result';

// Re-export the shared shapes so callers can import everything from the seam.
export type { ChatInput, ChatError, LolaResponse };

/** Resolved inference backend for the current request. */
export function inferenceMode(): 'local' | 'cloud' {
  const v = Settings.getStringSync(Settings.KEYS.inferenceMode, CONFIG.LOCAL_INFERENCE_DEFAULT);
  return v === 'local' ? 'local' : 'cloud';
}

function cloudFallbackAllowed(): boolean {
  return Settings.getBoolSync(Settings.KEYS.allowCloudFallback, false);
}

/** Vision (Describe/Ask). Routes to the on-device VLM or the cloud model. */
export async function chat(input: ChatInput): Promise<Result<LolaResponse, ChatError>> {
  if (inferenceMode() === 'local') {
    // Only one LLM may be resident (executorch single runner + A12 RAM) — make
    // the VLM the resident model, evicting the text model if it's loaded.
    await ensureResident('vlm');
    const local = await VlmAdapter.describeLocal(input);
    if (local.ok || !cloudFallbackAllowed()) return local;
    // Opt-in safety net: a local failure retries on the cloud (needs an API key).
    console.log('[router] local VLM failed, falling back to cloud:', local.error);
    return cloud.chat(input);
  }
  return cloud.chat(input);
}

/** Text-only structured JSON (intent routing, guide-target resolution). */
export async function chatJson<T = unknown>(input: ChatInput): Promise<Result<T, ChatError>> {
  if (inferenceMode() === 'local') {
    await ensureResident('text');
    const local = await TextAdapter.generateJsonLocal<T>(input);
    if (local.ok || !cloudFallbackAllowed()) return local;
    console.log('[router] local text-LLM failed, falling back to cloud:', local.error);
    return cloud.chatJson<T>(input);
  }
  return cloud.chatJson<T>(input);
}
