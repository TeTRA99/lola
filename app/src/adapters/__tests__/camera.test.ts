// Mock expo-camera + expo-image-manipulator at module load (native modules
// can't run under Jest's Node env).

jest.mock('expo-camera', () => ({
  Camera: {
    requestCameraPermissionsAsync: jest.fn(),
    getCameraPermissionsAsync: jest.fn(),
  },
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

import { captureSnapshot, _setCameraRefForTests } from '../camera';
import { Camera } from 'expo-camera';
import { manipulateAsync } from 'expo-image-manipulator';

const mockedRequestPerm = Camera.requestCameraPermissionsAsync as jest.MockedFunction<
  typeof Camera.requestCameraPermissionsAsync
>;
const mockedManipulate = manipulateAsync as jest.MockedFunction<typeof manipulateAsync>;

beforeEach(() => {
  jest.clearAllMocks();
  _setCameraRefForTests(null);
});

describe('captureSnapshot', () => {
  test('returns permission_denied when permission not granted', async () => {
    mockedRequestPerm.mockResolvedValue({
      status: 'denied', granted: false, expires: 'never', canAskAgain: true,
    } as Awaited<ReturnType<typeof Camera.requestCameraPermissionsAsync>>);

    const r = await captureSnapshot();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('permission_denied');
  });

  test('returns no_camera when permission OK but no CameraView ref registered', async () => {
    mockedRequestPerm.mockResolvedValue({
      status: 'granted', granted: true, expires: 'never', canAskAgain: true,
    } as Awaited<ReturnType<typeof Camera.requestCameraPermissionsAsync>>);
    _setCameraRefForTests(null);

    const r = await captureSnapshot();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('no_camera');
  });

  test('returns ok when small enough — skips resize', async () => {
    mockedRequestPerm.mockResolvedValue({
      status: 'granted', granted: true, expires: 'never', canAskAgain: true,
    } as Awaited<ReturnType<typeof Camera.requestCameraPermissionsAsync>>);

    const fakeRef = {
      takePictureAsync: jest.fn().mockResolvedValue({
        uri: 'file:///photo.jpg',
        base64: 'BASE64DATA',
        width: 800,
        height: 600,
      }),
    };
    _setCameraRefForTests(fakeRef);

    const r = await captureSnapshot();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.width).toBe(800);
      expect(r.value.height).toBe(600);
      expect(r.value.base64).toBe('BASE64DATA');
    }
    expect(mockedManipulate).not.toHaveBeenCalled();
  });

  test('resizes when longer edge exceeds 1024', async () => {
    mockedRequestPerm.mockResolvedValue({
      status: 'granted', granted: true, expires: 'never', canAskAgain: true,
    } as Awaited<ReturnType<typeof Camera.requestCameraPermissionsAsync>>);

    const fakeRef = {
      takePictureAsync: jest.fn().mockResolvedValue({
        uri: 'file:///photo.jpg',
        base64: 'BIG',
        width: 4000,
        height: 3000,
      }),
    };
    _setCameraRefForTests(fakeRef);

    mockedManipulate.mockResolvedValue({
      uri: 'file:///resized.jpg', base64: 'RESIZED', width: 1024, height: 768,
    } as Awaited<ReturnType<typeof manipulateAsync>>);

    const r = await captureSnapshot();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.width).toBe(1024);
      expect(r.value.height).toBe(768);
      expect(r.value.base64).toBe('RESIZED');
    }
    expect(mockedManipulate).toHaveBeenCalledTimes(1);
  });

  // B5 regression — CameraHost mount race.
  test('polls briefly for cameraRef when permission just granted', async () => {
    mockedRequestPerm.mockResolvedValue({
      status: 'granted', granted: true, expires: 'never', canAskAgain: true,
    } as Awaited<ReturnType<typeof Camera.requestCameraPermissionsAsync>>);

    // Ref starts null (CameraHost not mounted yet); simulate the host
    // registering the ref ~150ms later.
    _setCameraRefForTests(null);
    const fakeRef = {
      takePictureAsync: jest.fn().mockResolvedValue({
        uri: 'file:///photo.jpg',
        base64: 'BASE64',
        width: 800,
        height: 600,
      }),
    };
    setTimeout(() => _setCameraRefForTests(fakeRef), 150);

    const r = await captureSnapshot();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.base64).toBe('BASE64');
  });

  test('still returns no_camera if ref never registers within the poll window', async () => {
    mockedRequestPerm.mockResolvedValue({
      status: 'granted', granted: true, expires: 'never', canAskAgain: true,
    } as Awaited<ReturnType<typeof Camera.requestCameraPermissionsAsync>>);
    _setCameraRefForTests(null);

    const r = await captureSnapshot();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('no_camera');
  }, 5000);

  test('returns capture_failed when takePictureAsync returns no base64', async () => {
    mockedRequestPerm.mockResolvedValue({
      status: 'granted', granted: true, expires: 'never', canAskAgain: true,
    } as Awaited<ReturnType<typeof Camera.requestCameraPermissionsAsync>>);

    const fakeRef = {
      takePictureAsync: jest.fn().mockResolvedValue({
        uri: 'file:///photo.jpg', width: 800, height: 600,
      }),
    };
    _setCameraRefForTests(fakeRef);

    const r = await captureSnapshot();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('capture_failed');
  });
});
