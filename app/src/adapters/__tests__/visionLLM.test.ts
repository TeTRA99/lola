// Unit tests for the on-device VLM adapter's pure mapping + the describeLocal
// happy path (native executorch is auto-mocked → generate() returns a stub).

jest.mock('@/adapters/storage', () => ({ getDb: jest.fn() }));

import { toLolaResponse, describeLocal } from '../visionLLM';

describe('toLolaResponse', () => {
  it('treats plain prose as the narration with empty objects', () => {
    const r = toLolaResponse('  Hay una taza sobre la mesa.  ');
    expect(r.narration).toBe('Hay una taza sobre la mesa.');
    expect(r.objects).toEqual([]);
  });

  it('parses a well-formed {narration, objects} JSON block when the model emits one', () => {
    const json = JSON.stringify({
      narration: 'Una taza azul.',
      objects: [{ canonical: 'cup', display: 'taza', room_hint: null }],
    });
    const r = toLolaResponse('```json\n' + json + '\n```');
    expect(r.narration).toBe('Una taza azul.');
    expect(r.objects).toHaveLength(1);
    expect(r.objects[0].canonical).toBe('cup');
  });

  it('salvages the narration from malformed JSON instead of reading braces aloud', () => {
    const bad = '{"narration":"Una taza azul sobre la mesa","objects":[{"canonical":1}]}';
    const r = toLolaResponse(bad);
    expect(r.objects).toEqual([]);
    expect(r.narration).toBe('Una taza azul sobre la mesa');
  });

  it('salvages the narration from JSON truncated mid-object (the A12 leak case)', () => {
    // Token-capped before the closing brace — exactly what leaked on device.
    const truncated = '{ "narration": "Un hombre mira una laptop de estilo plateado", "objects": [{ "cano';
    const r = toLolaResponse(truncated);
    expect(r.narration).toBe('Un hombre mira una laptop de estilo plateado');
    expect(r.objects).toEqual([]);
  });
});

describe('describeLocal', () => {
  it('returns ok with the mocked narration', async () => {
    const res = await describeLocal({
      systemPrompt: 'sys',
      userText: 'Describe esta escena.',
      imageUri: 'file:///snap/x.jpg',
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.narration).toBe('mock narration');
  });
});
