// OpenRouter gateway — single provider-agnostic surface for vision-LLM calls.
// Per NFR-11: all model calls go through OpenRouter (not direct Google AI Studio).
// Architecture §5.1 spec'd the request shape, retry policy, headers.

import { CONFIG } from '@/config';
import { ok, err, type Result } from '@/utils/result';

export type ChatError = 'network' | 'auth' | 'rate_limit' | 'parse_fail' | 'unknown';

export type LolaObject = { canonical: string; display: string; room_hint: string | null };
export type LolaResponse = { narration: string; objects: LolaObject[] };

export type ChatInput = {
  systemPrompt: string;
  userText: string;
  imageBase64: string;
  model?: string;
};

// EXPO_PUBLIC_* are inlined at build time and readable from client code.
// Set in EAS secret store for production; in .env.local for dev.
// Read dynamically so test code can override via process.env after import.
function apiKey(): string | undefined {
  return process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
}

const RETRY_DELAYS_MS = [250, 750];
const PER_ATTEMPT_TIMEOUT_MS = 8000;

function buildBody(input: ChatInput): unknown {
  return {
    model: input.model ?? CONFIG.MODEL_ID,
    messages: [
      { role: 'system', content: input.systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: input.userText },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${input.imageBase64}` },
          },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 400,
    temperature: 0.3,
  };
}

async function postOnce(input: ChatInput, signal: AbortSignal): Promise<Response> {
  return fetch(`${CONFIG.GATEWAY_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'HTTP-Referer': 'https://lola.local',
      'X-Title': 'Lola v0.9',
    },
    body: JSON.stringify(buildBody(input)),
    signal,
  });
}

export async function chat(input: ChatInput): Promise<Result<LolaResponse, ChatError>> {
  if (!apiKey()) return err('auth');

  for (let attempt = 0; ; attempt++) {
    const ctl = new AbortController();
    const timeoutId = setTimeout(() => ctl.abort(), PER_ATTEMPT_TIMEOUT_MS);
    let resp: Response;
    try {
      resp = await postOnce(input, ctl.signal);
    } catch {
      clearTimeout(timeoutId);
      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      return err('network');
    }
    clearTimeout(timeoutId);

    if (resp.status === 401 || resp.status === 403) return err('auth');
    if (resp.status === 429) return err('rate_limit');
    if (resp.status >= 500 && resp.status < 600) {
      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      return err('network');
    }
    if (!resp.ok) return err('unknown');

    let body: { choices?: Array<{ message?: { content?: string } }> };
    try {
      body = (await resp.json()) as typeof body;
    } catch {
      return err('parse_fail');
    }

    const content = body.choices?.[0]?.message?.content;
    if (!content) return err('parse_fail');

    let parsed: LolaResponse;
    try {
      parsed = JSON.parse(content) as LolaResponse;
    } catch {
      return err('parse_fail');
    }
    if (
      typeof parsed.narration !== 'string' ||
      !Array.isArray(parsed.objects)
    ) {
      return err('parse_fail');
    }
    return ok(parsed);
  }
}
