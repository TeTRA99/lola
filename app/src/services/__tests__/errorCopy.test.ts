import { errorCopyFor, isLowConfidenceResponse, type ErrorKind } from '../errorCopy';
import { COPY } from '../CopyModule';

describe('errorCopyFor', () => {
  const cases: Array<[ErrorKind, string]> = [
    ['low_confidence', COPY.errors.lowConfidence],
    ['network', COPY.errors.noNetwork],
    ['permission_denied_camera', COPY.errors.cameraPermission],
    ['permission_denied_mic', COPY.errors.micPermission],
    ['parse_fail', COPY.errors.generic],
    ['no_camera', COPY.errors.generic],
    ['no_speech', COPY.errors.generic],
    ['timeout', COPY.errors.generic],
    ['no_locale', COPY.errors.generic],
    ['engine_unavailable', COPY.errors.generic],
    ['auth', COPY.errors.generic],
    ['rate_limit', COPY.errors.generic],
    ['unknown', COPY.errors.generic],
  ];

  for (const [kind, expected] of cases) {
    test(`${kind} → ${expected.slice(0, 30)}...`, () => {
      expect(errorCopyFor(kind)).toBe(expected);
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
