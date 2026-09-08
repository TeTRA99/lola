// Unit tests for the on-device text-LLM adapter's JSON extraction + the
// generateJsonLocal path (native executorch auto-mocked → generate() stub).

jest.mock('@/adapters/storage', () => ({ getDb: jest.fn() }));

import { LLMModule } from 'react-native-executorch/legacy';
import { extractJson, generateJsonLocal, _resetForTests } from '../textLLM';

beforeEach(() => {
  _resetForTests();
  (LLMModule.fromModelName as jest.Mock).mockClear();
});

describe('extractJson', () => {
  it('pulls a JSON object out of chatty output', () => {
    const out = 'Claro, acá tenés:\n```json\n{"intent":"guide","noun":"taza"}\n```\n¡Listo!';
    expect(extractJson<{ intent: string; noun: string }>(out)).toEqual({ intent: 'guide', noun: 'taza' });
  });

  it('returns null when there is no JSON object', () => {
    expect(extractJson('no json here')).toBeNull();
  });

  it('returns null on malformed JSON', () => {
    expect(extractJson('{ not: valid }')).toBeNull();
  });
});

describe('generateJsonLocal', () => {
  it('parses the model output into the requested shape', async () => {
    (LLMModule.fromModelName as jest.Mock).mockResolvedValueOnce({
      configure: jest.fn(),
      sendMessage: jest.fn(async () => [{ role: 'assistant', content: '{"intent":"model","needsCurrent":true}' }]),
      interrupt: jest.fn(),
      delete: jest.fn(),
    });
    const res = await generateJsonLocal<{ intent: string; needsCurrent: boolean }>({
      systemPrompt: 'sys',
      userText: '¿qué es esto?',
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.intent).toBe('model');
  });

  it('returns parse_fail when the model emits no JSON', async () => {
    (LLMModule.fromModelName as jest.Mock).mockResolvedValueOnce({
      configure: jest.fn(),
      sendMessage: jest.fn(async () => [{ role: 'assistant', content: 'sorry, no idea' }]),
      interrupt: jest.fn(),
      delete: jest.fn(),
    });
    const res = await generateJsonLocal({ systemPrompt: 'sys', userText: 'x' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('parse_fail');
  });
});
