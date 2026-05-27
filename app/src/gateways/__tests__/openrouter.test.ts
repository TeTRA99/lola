// Mock fetch + inject the API key so the gateway accepts the request path.
process.env.EXPO_PUBLIC_OPENROUTER_API_KEY = 'sk-or-v1-test-fake';

import { chat } from '../openrouter';
import { buildSystemPrompt } from '@/prompts/lola';

const mockFetch = jest.fn();
(globalThis as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;

function mockResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

function mockOpenRouterChoice(content: string) {
  return { choices: [{ message: { content } }] };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('openrouter.chat', () => {
  test('happy path returns parsed LolaResponse', async () => {
    const payload = JSON.stringify({
      narration: 'Una taza azul sobre la mesa.',
      objects: [{ canonical: 'taza_azul', display: 'la taza', room_hint: 'cocina' }],
    });
    mockFetch.mockReturnValue(mockResponse(200, mockOpenRouterChoice(payload)));

    const r = await chat({ systemPrompt: 'sys', userText: 'desc', imageBase64: 'abc' });

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.narration).toBe('Una taza azul sobre la mesa.');
      expect(r.value.objects).toHaveLength(1);
      expect(r.value.objects[0].canonical).toBe('taza_azul');
    }
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('sends correct headers', async () => {
    mockFetch.mockReturnValue(
      mockResponse(200, mockOpenRouterChoice(JSON.stringify({ narration: 'ok', objects: [] }))),
    );
    await chat({ systemPrompt: 's', userText: 'u', imageBase64: 'x' });
    const callArgs = mockFetch.mock.calls[0][1];
    expect(callArgs.headers['Authorization']).toBe('Bearer sk-or-v1-test-fake');
    expect(callArgs.headers['HTTP-Referer']).toBe('https://lola.local');
    expect(callArgs.headers['X-Title']).toBe('Lola v0.9');
  });

  test('sends correct body shape', async () => {
    mockFetch.mockReturnValue(
      mockResponse(200, mockOpenRouterChoice(JSON.stringify({ narration: 'ok', objects: [] }))),
    );
    await chat({ systemPrompt: 'SYS', userText: 'TXT', imageBase64: 'BASE64' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe('google/gemini-2.5-flash');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.max_tokens).toBe(400);
    expect(body.temperature).toBe(0.3);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'SYS' });
    expect(body.messages[1].content[0]).toEqual({ type: 'text', text: 'TXT' });
    expect(body.messages[1].content[1].image_url.url).toBe('data:image/jpeg;base64,BASE64');
  });

  test('401 returns err("auth")', async () => {
    mockFetch.mockReturnValue(mockResponse(401, {}));
    const r = await chat({ systemPrompt: 's', userText: 'u', imageBase64: 'x' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('auth');
  });

  test('429 returns err("rate_limit")', async () => {
    mockFetch.mockReturnValue(mockResponse(429, {}));
    const r = await chat({ systemPrompt: 's', userText: 'u', imageBase64: 'x' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('rate_limit');
  });

  // B4 fix: retry budget tightened to 1 retry (was 2) to respect NFR-1.
  test('503 retries once then bubbles err("network")', async () => {
    mockFetch
      .mockReturnValueOnce(mockResponse(503, {}))
      .mockReturnValueOnce(mockResponse(503, {}));
    const r = await chat({ systemPrompt: 's', userText: 'u', imageBase64: 'x' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('network');
    expect(mockFetch).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
  });

  test('503 then 200 succeeds (retry recovery)', async () => {
    mockFetch
      .mockReturnValueOnce(mockResponse(503, {}))
      .mockReturnValueOnce(
        mockResponse(200, mockOpenRouterChoice(JSON.stringify({ narration: 'ok', objects: [] }))),
      );
    const r = await chat({ systemPrompt: 's', userText: 'u', imageBase64: 'x' });
    expect(r.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('malformed JSON content returns err("parse_fail")', async () => {
    mockFetch.mockReturnValue(mockResponse(200, mockOpenRouterChoice('not valid json {')));
    const r = await chat({ systemPrompt: 's', userText: 'u', imageBase64: 'x' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('parse_fail');
  });

  test('JSON parses but missing fields returns err("parse_fail")', async () => {
    mockFetch.mockReturnValue(
      mockResponse(200, mockOpenRouterChoice(JSON.stringify({ foo: 'bar' }))),
    );
    const r = await chat({ systemPrompt: 's', userText: 'u', imageBase64: 'x' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('parse_fail');
  });

  // B2 regression — shallow validation must reject objects[] entries missing fields.
  test('objects with missing canonical/display fields returns err("parse_fail")', async () => {
    mockFetch.mockReturnValue(
      mockResponse(200, mockOpenRouterChoice(JSON.stringify({
        narration: 'ok',
        objects: [{}, { canonical: 'x' }],  // both malformed
      }))),
    );
    const r = await chat({ systemPrompt: 's', userText: 'u', imageBase64: 'x' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('parse_fail');
  });

  test('objects with valid shape pass validation', async () => {
    mockFetch.mockReturnValue(
      mockResponse(200, mockOpenRouterChoice(JSON.stringify({
        narration: 'ok',
        objects: [
          { canonical: 'taza', display: 'una taza', room_hint: 'cocina' },
          { canonical: 'mate', display: 'el mate', room_hint: null },
        ],
      }))),
    );
    const r = await chat({ systemPrompt: 's', userText: 'u', imageBase64: 'x' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.objects).toHaveLength(2);
  });

  test('custom model overrides default', async () => {
    mockFetch.mockReturnValue(
      mockResponse(200, mockOpenRouterChoice(JSON.stringify({ narration: 'ok', objects: [] }))),
    );
    await chat({
      systemPrompt: 's', userText: 'u', imageBase64: 'x',
      model: 'google/gemini-2.5-flash-lite',
    });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe('google/gemini-2.5-flash-lite');
  });
});

describe('openrouter.chat prompt builder integration', () => {
  test('prompt template is callable with null catalog', () => {
    const prompt = buildSystemPrompt(null);
    expect(prompt).toContain('voseo');
    expect(prompt).toContain('"narration"');
    expect(prompt).not.toContain('canonical id:'); // catalog block omitted when null
  });

  test('prompt template includes catalog block when non-empty', () => {
    const prompt = buildSystemPrompt([
      { id: 1, canonical_name: 'cepillo_papa', display_name: 'tu cepillo', description: 'el verde', reference_image_uri: null },
    ]);
    expect(prompt).toContain('tu cepillo');
    expect(prompt).toContain('cepillo_papa');
    expect(prompt).toContain('el verde');
  });
});
