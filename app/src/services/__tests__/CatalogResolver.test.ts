import { applyCatalogNarration, resolveDisplayName } from '../CatalogResolver';
import type { CatalogObject } from '../OnboardingService';

const catalog: CatalogObject[] = [
  { id: 1, canonical_name: 'cepillo_de_papa', display_name: 'tu cepillo', description: null, reference_image_uri: null },
  { id: 2, canonical_name: 'yerba_cruz_de_malta', display_name: 'tu yerba', description: null, reference_image_uri: null },
];

describe('resolveDisplayName', () => {
  test('returns catalog display for canonical match', () => {
    expect(resolveDisplayName('cepillo_de_papa', catalog)).toBe('tu cepillo');
  });
  test('returns null when no match', () => {
    expect(resolveDisplayName('xyz', catalog)).toBeNull();
  });
});

describe('applyCatalogNarration', () => {
  test('empty catalog → passthrough', () => {
    expect(applyCatalogNarration('una taza', [], [])).toBe('una taza');
  });

  test('substitutes first occurrence when canonical matches', () => {
    const narration = 'Hay un cepillo sobre la mesa';
    const objects = [{ canonical: 'cepillo_de_papa', display: 'un cepillo', room_hint: null }];
    expect(applyCatalogNarration(narration, objects, catalog))
      .toBe('Hay tu cepillo sobre la mesa');
  });

  test('no-op when display already matches catalog', () => {
    const narration = 'Hay tu cepillo sobre la mesa';
    const objects = [{ canonical: 'cepillo_de_papa', display: 'tu cepillo', room_hint: null }];
    expect(applyCatalogNarration(narration, objects, catalog))
      .toBe('Hay tu cepillo sobre la mesa');
  });

  test('no-op when canonical not in catalog', () => {
    const narration = 'Hay una taza azul';
    const objects = [{ canonical: 'taza_azul', display: 'una taza azul', room_hint: null }];
    expect(applyCatalogNarration(narration, objects, catalog))
      .toBe('Hay una taza azul');
  });

  test('multiple objects: each is substituted', () => {
    const narration = 'Veo un cepillo y una yerba';
    const objects = [
      { canonical: 'cepillo_de_papa', display: 'un cepillo', room_hint: null },
      { canonical: 'yerba_cruz_de_malta', display: 'una yerba', room_hint: null },
    ];
    expect(applyCatalogNarration(narration, objects, catalog))
      .toBe('Veo tu cepillo y tu yerba');
  });

  test('first-occurrence-only (later same-display tokens left alone)', () => {
    const narration = 'un cepillo encima de un cepillo más chico';
    const objects = [{ canonical: 'cepillo_de_papa', display: 'un cepillo', room_hint: null }];
    expect(applyCatalogNarration(narration, objects, catalog))
      .toBe('tu cepillo encima de un cepillo más chico');
  });
});
