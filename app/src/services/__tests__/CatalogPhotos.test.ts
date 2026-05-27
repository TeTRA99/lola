type FakeFile = { uri: string; written?: string; size: number };
const mockWrittenFiles = new Map<string, FakeFile>();
const mockCreatedDirs = new Set<string>();
const mockDirChildren = new Map<string, Array<{ uri: string; isFile: boolean }>>();

jest.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    constructor(parent: { uri: string } | string, name?: string) {
      const base = typeof parent === 'string' ? parent : parent.uri;
      this.uri = name ? `${base}/${name}` : base;
    }
    get exists() { return mockCreatedDirs.has(this.uri); }
    create() {
      mockCreatedDirs.add(this.uri);
      if (!mockDirChildren.has(this.uri)) mockDirChildren.set(this.uri, []);
    }
    list() {
      return (mockDirChildren.get(this.uri) ?? []).map(c =>
        c.isFile ? new File(c.uri) : new Directory(c.uri),
      );
    }
    delete() {
      mockCreatedDirs.delete(this.uri);
      mockDirChildren.delete(this.uri);
    }
  }
  class File {
    uri: string;
    constructor(parent: { uri: string } | string, name?: string) {
      const base = typeof parent === 'string' ? parent : parent.uri;
      this.uri = name ? `${base}/${name}` : base;
    }
    get size(): number | null { return mockWrittenFiles.get(this.uri)?.size ?? null; }
    write(content: string) {
      mockWrittenFiles.set(this.uri, { uri: this.uri, written: content, size: 100 });
      // Register the file as a child of its parent dir.
      const parent = this.uri.substring(0, this.uri.lastIndexOf('/'));
      const kids = mockDirChildren.get(parent) ?? [];
      kids.push({ uri: this.uri, isFile: true });
      mockDirChildren.set(parent, kids);
    }
  }
  return { Directory, File, Paths: { document: 'file:///doc' } };
});

jest.mock('@/adapters/camera', () => ({
  captureSnapshot: jest.fn(),
}));

import * as CatalogPhotos from '../CatalogPhotos';
import { captureSnapshot } from '@/adapters/camera';

const mCapture = captureSnapshot as jest.MockedFunction<typeof captureSnapshot>;

beforeEach(() => {
  jest.clearAllMocks();
  mockWrittenFiles.clear();
  mockCreatedDirs.clear();
  mockDirChildren.clear();
});

function snapshotOk(base64 = 'BASE64') {
  mCapture.mockResolvedValue({
    ok: true,
    value: { uri: 'file:///tmp.jpg', base64, width: 800, height: 600 },
  });
}

describe('CatalogPhotos', () => {
  test('captureForObject saves to /catalog/<id>/1.jpg on first call', async () => {
    snapshotOk();
    const r = await CatalogPhotos.captureForObject(42);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('file:///doc/catalog/42/1.jpg');
  });

  test('subsequent calls increment the index (1, 2, 3)', async () => {
    snapshotOk();
    await CatalogPhotos.captureForObject(42);
    await CatalogPhotos.captureForObject(42);
    const r3 = await CatalogPhotos.captureForObject(42);
    expect(r3.ok).toBe(true);
    if (r3.ok) expect(r3.value).toBe('file:///doc/catalog/42/3.jpg');
  });

  test('4th capture returns err("limit_reached")', async () => {
    snapshotOk();
    await CatalogPhotos.captureForObject(42);
    await CatalogPhotos.captureForObject(42);
    await CatalogPhotos.captureForObject(42);
    const r4 = await CatalogPhotos.captureForObject(42);
    expect(r4.ok).toBe(false);
    if (!r4.ok) expect(r4.error).toBe('limit_reached');
  });

  test('camera permission denied surfaces as permission_denied', async () => {
    mCapture.mockResolvedValue({ ok: false, error: 'permission_denied' });
    const r = await CatalogPhotos.captureForObject(42);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('permission_denied');
  });

  test('other capture failures surface as capture_failed', async () => {
    mCapture.mockResolvedValue({ ok: false, error: 'no_camera' });
    const r = await CatalogPhotos.captureForObject(42);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('capture_failed');
  });

  test('removeForObject deletes the object directory + cascades children', async () => {
    snapshotOk();
    await CatalogPhotos.captureForObject(42);
    await CatalogPhotos.captureForObject(42);
    expect(mockCreatedDirs.has('file:///doc/catalog/42')).toBe(true);
    CatalogPhotos.removeForObject(42);
    expect(mockCreatedDirs.has('file:///doc/catalog/42')).toBe(false);
    expect(CatalogPhotos.listForObject(42)).toEqual([]);
  });

  test('listForObject returns sorted file URIs', async () => {
    snapshotOk();
    await CatalogPhotos.captureForObject(7);
    await CatalogPhotos.captureForObject(7);
    const uris = CatalogPhotos.listForObject(7);
    expect(uris).toHaveLength(2);
    expect(uris[0]).toBe('file:///doc/catalog/7/1.jpg');
    expect(uris[1]).toBe('file:///doc/catalog/7/2.jpg');
  });
});
