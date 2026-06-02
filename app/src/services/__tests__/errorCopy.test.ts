import { errorCopyFor, isLowConfidenceResponse, type ErrorKind } from '../errorCopy';
import { COPY } from '../CopyModule';

describe('errorCopyFor', () => {
  // Specific kinds map to a single exact line.
  const exactCases: Array<[ErrorKind, string]> = [
    ['low_confidence', COPY.errors.lowConfidence],
    ['network', COPY.errors.noNetwork],
    ['permission_denied_camera', COPY.errors.cameraPermission],
    ['permission_denied_mic', COPY.errors.micPermission],
  ];
  for (const [kind, expected] of exactCases) {
    test(`${kind} → exact copy`, () => {
      expect(errorCopyFor(kind)).toBe(expected);
    });
  }

  // Generic kinds rotate randomly through genericVariants — assert membership.
  const genericKinds: ErrorKind[] = [
    'parse_fail', 'no_camera', 'no_speech', 'timeout', 'no_locale',
    'engine_unavailable', 'auth', 'rate_limit', 'unknown',
  ];
  for (const kind of genericKinds) {
    test(`${kind} → one of the generic variants`, () => {
      expect(COPY.errors.genericVariants).toContain(errorCopyFor(kind));
    });
  }
});

describe('isLowConfidenceResponse', () => {
  test('empty objects + "No estoy segura" prefix → true', () => {
    expect(isLowConfidenceResponse({ narration: 'No estoy segura — ¿podés acercarte?', objects: [] }))
      .toBe(true);
  });

  test('empty objects + "No tengo" prefix → true', () => {
    expect(isLowConfidenceResponse({ narration: 'No tengo señal ahora', objects: [] }))
      .toBe(true);
  });

  test('empty objects + normal narration → false', () => {
    expect(isLowConfidenceResponse({ narration: 'Una taza azul', objects: [] })).toBe(false);
  });

  test('low-confidence prefix WITH objects → false (model still produced data)', () => {
    expect(isLowConfidenceResponse({
      narration: 'No estoy segura',
      objects: [{ canonical: 'x', display: 'y', room_hint: null }],
    })).toBe(false);
  });
});
