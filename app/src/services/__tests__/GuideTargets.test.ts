import { resolveGuideTarget, isGuidable } from '@/services/GuideTargets';

describe('resolveGuideTarget', () => {
  it('maps common Spanish nouns to COCO labels', () => {
    expect(resolveGuideTarget('taza')?.cocoLabel).toBe('cup');
    expect(resolveGuideTarget('botella')?.cocoLabel).toBe('bottle');
    expect(resolveGuideTarget('silla')?.cocoLabel).toBe('chair');
    expect(resolveGuideTarget('cuchillo')?.cocoLabel).toBe('knife');
  });

  it('handles accents, case, and plurals', () => {
    expect(resolveGuideTarget('Teléfono')?.cocoLabel).toBe('cell phone');
    expect(resolveGuideTarget('TAZÓN')?.cocoLabel).toBe('bowl');
    expect(resolveGuideTarget('sillas')?.cocoLabel).toBe('chair');
  });

  it('matches multi-word and noun-inside-phrase', () => {
    expect(resolveGuideTarget('control remoto')?.cocoLabel).toBe('remote');
    expect(resolveGuideTarget('una taza amarilla')?.cocoLabel).toBe('cup');
  });

  it('keeps the original spoken noun', () => {
    expect(resolveGuideTarget('la botella')?.spoken).toBe('la botella');
  });

  it('returns null (graceful fallback) for objects we cannot track yet', () => {
    expect(resolveGuideTarget('lápiz')).toBeNull();
    expect(resolveGuideTarget('anteojos')).toBeNull();
    expect(resolveGuideTarget('llaves')).toBeNull();
    expect(resolveGuideTarget('')).toBeNull();
    expect(resolveGuideTarget(null)).toBeNull();
    expect(resolveGuideTarget(undefined)).toBeNull();
  });

  it('isGuidable mirrors resolveGuideTarget', () => {
    expect(isGuidable('taza')).toBe(true);
    expect(isGuidable('lápiz')).toBe(false);
  });
});
