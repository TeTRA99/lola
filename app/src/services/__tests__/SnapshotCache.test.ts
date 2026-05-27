// Mock expo-file-system at module load — Jest can't load the native bridge.

type FakeFile = { uri: string; written?: string; size: number; deleted?: boolean };
const mockWrittenFiles = new Map<string, FakeFile>();
const mockCreatedDirs = new Set<string>();

jest.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    constructor(parent: { uri: string } | string, name?: string) {
      const base = typeof parent === 'string' ? parent : parent.uri;
      this.uri = name ? `${base}/${name}` : base;
    }
    get exists() { return mockCreatedDirs.has(this.uri); }
    create() { mockCreatedDirs.add(this.uri); }
  }
  class File {
    uri: string;
    constructor(parent: { uri: string } | string, name?: string) {
      const base = typeof parent === 'string' ? parent : parent.uri;
      this.uri = name ? `${base}/${name}` : base;
    }
    get size(): number | null { return mockWrittenFiles.get(this.uri)?.size ?? null; }
    write(content: string) {
      mockWrittenFiles.set(this.uri, {
        uri: this.uri,
        written: content,
        size: Math.floor((content.length * 3) / 4),
      });
    }
    delete() {
      const f = mockWrittenFiles.get(this.uri);
      if (f) f.deleted = true;
      mockWrittenFiles.delete(this.uri);
    }
  }
  return {
    Directory,
    File,
    Paths: { document: 'file:///doc' },
  };
});

import * as Cache from '../SnapshotCache';

beforeEach(() => {
  mockWrittenFiles.clear();
  mockCreatedDirs.clear();
  Cache._resetForTests();
});

describe('SnapshotCache', () => {
  test('saveSnapshot → getEntry roundtrip', () => {
    const uri = Cache.saveSnapshot('A'.repeat(100));
    const e = Cache.getEntry(uri);
    expect(e).not.toBeNull();
    expect(e?.uri).toBe(uri);
    expect(e?.sizeBytes).toBeGreaterThan(0);
  });

  test('getLatest returns most recent entry', () => {
    const u1 = Cache.saveSnapshot('one');
    // Force a different timestamp on the next save
    const realDateNow = Date.now;
    let n = realDateNow();
    Date.now = () => ++n;
    const u2 = Cache.saveSnapshot('two');
    Date.now = realDateNow;
    expect(Cache.getLatest()?.uri).toBe(u2);
    expect(u1).not.toBe(u2);
  });

  test('attachNarration sets the narration on an entry', () => {
    const uri = Cache.saveSnapshot('x');
    Cache.attachNarration(uri, 'Una taza azul');
    expect(Cache.getEntry(uri)?.narration).toBe('Una taza azul');
  });

  test('LRU eviction by count: oldest dropped when > CACHE_MAX_SNAPSHOTS', () => {
    // Save 51 entries; eviction triggers on the 51st insert.
    const realDateNow = Date.now;
    let n = realDateNow();
    Date.now = () => n++;
    const first = Cache.saveSnapshot('first');
    for (let i = 0; i < 50; i++) Cache.saveSnapshot(`s${i}`);
    Date.now = realDateNow;
    // The very first entry should have been evicted.
    expect(Cache.getEntry(first)).toBeNull();
  });

  test('LRU eviction by bytes: oldest dropped when totalBytes > CACHE_MAX_BYTES', () => {
    // Mock 100MB-sized payloads — third save should evict first.
    const HUGE = 'A'.repeat(140 * 1024 * 1024 * 4 / 3); // approx 140MB decoded
    const realDateNow = Date.now;
    let n = realDateNow();
    Date.now = () => n++;
    const u1 = Cache.saveSnapshot(HUGE);
    const u2 = Cache.saveSnapshot(HUGE);   // total ~280MB > 200MB → u1 evicted
    Date.now = realDateNow;
    expect(Cache.getEntry(u1)).toBeNull();
    expect(Cache.getEntry(u2)).not.toBeNull();
  });
});
