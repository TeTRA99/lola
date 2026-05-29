jest.mock('@/gateways/openrouter', () => ({ chatJson: jest.fn() }));

import { chatJson } from '@/gateways/openrouter';
import { resolveGuideTarget } from '@/services/GuideTargets';

const mockChatJson = chatJson as unknown as jest.Mock;

beforeEach(() => mockChatJson.mockReset());

describe('resolveGuideTarget (LLM-based, no regex/dictionary)', () => {
  it('maps to the label the LLM returns, keeping the spoken noun', async () => {
    mockChatJson.mockResolvedValue({ ok: true, value: { label: 'cup' } });
    expect(await resolveGuideTarget('mi vaso')).toEqual({ cocoLabel: 'cup', spoken: 'mi vaso' });
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
