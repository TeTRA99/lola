// Mock fetch + inject the API key so the gateway accepts the request path.
process.env.EXPO_PUBLIC_OPENROUTER_API_KEY = 'sk-or-v1-test-fake';

import { chat, groundObject } from '../openrouter';
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

  // v1.1: retry budget widened to 2 retries (RETRY_DELAYS_MS = [500, 1500])
  // after on-device testing showed spotty home Wi-Fi tripping single-retry.
  test('503 retries twice then bubbles err("network")', async () => {
    mockFetch
      .mockReturnValueOnce(mockResponse(503, {}))
      .mockReturnValueOnce(mockResponse(503, {}))
      .mockReturnValueOnce(mockResponse(503, {}));
    const r = await chat({ systemPrompt: 's', userText: 'u', imageBase64: 'x' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('network');
    expect(mockFetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
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

describe('openrouter.groundObject (cloud guide spike)', () => {
  test('happy path returns the raw box + found + confidence + near', async () => {
    const payload = JSON.stringify({ found: true, box: [200, 100, 600, 500], confidence: 0.82, near: 'al lado del termo' });
    mockFetch.mockReturnValue(mockResponse(200, mockOpenRouterChoice(payload)));

    const r = await groundObject({ query: 'el auricular', frameBase64: 'FRAME', model: 'google/gemini-3.5-flash' });

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.found).toBe(true);
      expect(r.value.box).toEqual([200, 100, 600, 500]);
      expect(r.value.confidence).toBeCloseTo(0.82, 5);
      expect(r.value.near).toBe('al lado del termo');
    }
  });

  test('found:false (no box) returns found=false', async () => {
    mockFetch.mockReturnValue(
      mockResponse(200, mockOpenRouterChoice(JSON.stringify({ found: false, box: null, confidence: 0 }))),
    );
    const r = await groundObject({ query: 'el lápiz', frameBase64: 'F', model: 'google/gemini-3.5-flash' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.found).toBe(false);
      expect(r.value.box).toBeNull();
    }
  });

  test('found:true but malformed box → found=false (box rejected)', async () => {
    mockFetch.mockReturnValue(
      mockResponse(200, mockOpenRouterChoice(JSON.stringify({ found: true, box: [1, 2, 3], confidence: 0.5 }))),
    );
    const r = await groundObject({ query: 'x', frameBase64: 'F', model: 'google/gemini-3.5-flash' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.found).toBe(false);
  });

  test('uses the requested model and sends only the frame when no reference', async () => {
    mockFetch.mockReturnValue(
      mockResponse(200, mockOpenRouterChoice(JSON.stringify({ found: false, box: null, confidence: 0 }))),
    );
    await groundObject({ query: 'el mate', frameBase64: 'FRAME64', model: 'qwen/qwen3-vl-8b-instruct' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe('qwen/qwen3-vl-8b-instruct');
    // one text part + one image part (the scene frame).
    const imageParts = body.messages[1].content.filter((c: { type: string }) => c.type === 'image_url');
    expect(imageParts).toHaveLength(1);
    expect(imageParts[0].image_url.url).toBe('data:image/jpeg;base64,FRAME64');
    // Qwen gets a normalized 0–1000 instruction in [x1,y1,x2,y2] order.
    expect(body.messages[0].content).toContain('normalized coordinates from 0 to 1000');
    expect(body.messages[0].content).toContain('x1, y1, x2, y2');
  });

  test('reference targeting sends ref first, then the scene frame', async () => {
    mockFetch.mockReturnValue(
      mockResponse(200, mockOpenRouterChoice(JSON.stringify({ found: false, box: null, confidence: 0 }))),
    );
    await groundObject({ query: 'el auricular', frameBase64: 'SCENE', refBase64: 'REF', model: 'google/gemini-3.5-flash' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const imageParts = body.messages[1].content.filter((c: { type: string }) => c.type === 'image_url');
    expect(imageParts).toHaveLength(2);
    expect(imageParts[0].image_url.url).toBe('data:image/jpeg;base64,REF');   // reference first
    expect(imageParts[1].image_url.url).toBe('data:image/jpeg;base64,SCENE'); // scene second
    // Gemini gets a normalized-coordinate instruction.
    expect(body.messages[0].content).toContain('normalized coordinates from 0 to 1000');
  });

  test('auth error bubbles up', async () => {
    mockFetch.mockReturnValue(mockResponse(401, {}));
    const r = await groundObject({ query: 'x', frameBase64: 'F', model: 'google/gemini-3.5-flash' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('auth');
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
