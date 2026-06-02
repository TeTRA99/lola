jest.mock('@/services/ModelRouter', () => ({ chatJson: jest.fn() }));

import { chatJson } from '@/services/ModelRouter';
import { resolveGuideTarget } from '@/services/GuideTargets';

const mockChatJson = chatJson as unknown as jest.Mock;

beforeEach(() => mockChatJson.mockReset());

describe('resolveGuideTarget (LLM-based, no regex/dictionary)', () => {
  it('maps to the label the LLM returns, keeping the spoken noun', async () => {
    mockChatJson.mockResolvedValue({ ok: true, value: { label: 'cup' } });
    expect(await resolveGuideTarget('mi vaso')).toEqual({ cocoLabel: 'cup', spoken: 'mi vaso' });
  });

  it('treats an exact match as not-approximate (no warning flag)', async () => {
    mockChatJson.mockResolvedValue({ ok: true, value: { label: 'cup', match: 'exact' } });
    const r = await resolveGuideTarget('una taza');
    expect(r).toEqual({ cocoLabel: 'cup', spoken: 'una taza' });
    expect(r?.approximate).toBeUndefined();
  });

  it('flags an approximate match (proxy class) so the caller can warn', async () => {
    mockChatJson.mockResolvedValue({ ok: true, value: { label: 'bottle', match: 'approx' } });
    expect(await resolveGuideTarget('el termo')).toEqual({
      cocoLabel: 'bottle', spoken: 'el termo', approximate: true,
    });
  });

  it('returns null when the LLM says it is not in the set (graceful fallback)', async () => {
    mockChatJson.mockResolvedValue({ ok: true, value: { label: null } });
    expect(await resolveGuideTarget('un lápiz')).toBeNull();
  });

  it('guards against a label the LLM returns that is not actually detectable', async () => {
    mockChatJson.mockResolvedValue({ ok: true, value: { label: 'airplane' } });
    expect(await resolveGuideTarget('un avión')).toBeNull();
  });

  it('returns null on LLM failure', async () => {
    mockChatJson.mockResolvedValue({ ok: false, error: 'network' });
    expect(await resolveGuideTarget('una taza')).toBeNull();
  });

  it('does not call the LLM for empty input', async () => {
    expect(await resolveGuideTarget('')).toBeNull();
    expect(await resolveGuideTarget(null)).toBeNull();
    expect(await resolveGuideTarget(undefined)).toBeNull();
    expect(mockChatJson).not.toHaveBeenCalled();
  });
});
