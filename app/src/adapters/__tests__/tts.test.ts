jest.mock('expo-speech', () => ({
  // speak() now resolves only when the engine reports done — fire onDone so
  // the adapter's awaited promise settles in tests.
  speak: jest.fn((_text: string, opts?: { onDone?: () => void }) => { opts?.onDone?.(); }),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(),
}));

import * as Speech from 'expo-speech';
import { speak, stop, _resetForTests, RATE_DEFAULT } from '../tts';

const mockedSpeak = Speech.speak as jest.MockedFunction<typeof Speech.speak>;
const mockedStop = Speech.stop as jest.MockedFunction<typeof Speech.stop>;
const mockedVoices = Speech.getAvailableVoicesAsync as jest.MockedFunction<
  typeof Speech.getAvailableVoicesAsync
>;

beforeEach(() => {
  jest.clearAllMocks();
  _resetForTests();
});

describe('TTS adapter', () => {
  test('speak defaults to es-AR + default rate when voice available', async () => {
    mockedVoices.mockResolvedValue([
      { language: 'es-AR', identifier: 'x', name: 'y', quality: 'Default' },
    ] as Awaited<ReturnType<typeof Speech.getAvailableVoicesAsync>>);

    const r = await speak('hola');
    expect(r.ok).toBe(true);
    expect(mockedSpeak).toHaveBeenCalledWith('hola', expect.objectContaining({
      language: 'es-AR',
      rate: RATE_DEFAULT,
    }));
  });

  test('falls back to es-419 when es-AR not installed', async () => {
    mockedVoices.mockResolvedValue([
      { language: 'es-419', identifier: 'x', name: 'y', quality: 'Default' },
      { language: 'en-US', identifier: 'a', name: 'b', quality: 'Default' },
    ] as Awaited<ReturnType<typeof Speech.getAvailableVoicesAsync>>);

    await speak('hola');
    expect(mockedSpeak).toHaveBeenCalledWith('hola', expect.objectContaining({ language: 'es-419' }));
  });

  test('falls back to es-MX when es-AR and es-419 both absent', async () => {
    mockedVoices.mockResolvedValue([
      { language: 'es-MX', identifier: 'x', name: 'y', quality: 'Default' },
    ] as Awaited<ReturnType<typeof Speech.getAvailableVoicesAsync>>);

    await speak('hola');
    expect(mockedSpeak).toHaveBeenCalledWith('hola', expect.objectContaining({ language: 'es-MX' }));
  });

  test('opts.rate overrides the default', async () => {
    mockedVoices.mockResolvedValue([
      { language: 'es-AR', identifier: 'x', name: 'y', quality: 'Default' },
    ] as Awaited<ReturnType<typeof Speech.getAvailableVoicesAsync>>);

    await speak('hola', { rate: 1.0 });
    expect(mockedSpeak).toHaveBeenCalledWith('hola', expect.objectContaining({ rate: 1.0 }));
  });

  test('cached locale: second call does not re-probe voices', async () => {
    mockedVoices.mockResolvedValue([
      { language: 'es-AR', identifier: 'x', name: 'y', quality: 'Default' },
    ] as Awaited<ReturnType<typeof Speech.getAvailableVoicesAsync>>);

    await speak('uno');
    await speak('dos');
    expect(mockedVoices).toHaveBeenCalledTimes(1);
  });

  test('falls back to TTS_LOCALE when voice query throws', async () => {
    mockedVoices.mockRejectedValue(new Error('engine error'));
    await speak('hola');
    expect(mockedSpeak).toHaveBeenCalledWith('hola', expect.objectContaining({ language: 'es-AR' }));
  });

  test('stop() calls Speech.stop', () => {
    stop();
    expect(mockedStop).toHaveBeenCalledTimes(1);
  });
});
