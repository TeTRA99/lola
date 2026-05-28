// FR-3 SetupScreen — English UI, Charly-facing. Lists tagged objects with
// add/edit/remove flows. AC4.2.1–4.2.7.
//
// All strings in this file are deliberately English (dad never reaches this
// screen — entry is gated by E4.1's 5-second logo hold). CopyModule is
// dad-facing only; Charly's tool stays plain.

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as OnboardingService from '@/services/OnboardingService';
import * as CatalogPhotos from '@/services/CatalogPhotos';
import * as RoomCatalog from '@/services/RoomCatalog';
import * as Settings from '@/services/Settings';
import type { CatalogObject } from '@/services/OnboardingService';
import type { Room } from '@/services/RoomCatalog';
import { CapturePhotoModal } from './CapturePhotoModal';
import { onDownloadProgress } from '@/adapters/embeddings';

type Tab = 'objects' | 'rooms' | 'settings';
type ObjectMode =
  | { kind: 'list' }
  | { kind: 'add' }
  | { kind: 'edit'; obj: CatalogObject };
type RoomMode =
  | { kind: 'list' }
  | { kind: 'add' }
  | { kind: 'edit'; room: Room };

export function SetupScreen({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('objects');
  const [catalog, setCatalog] = useState<CatalogObject[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [objectMode, setObjectMode] = useState<ObjectMode>({ kind: 'list' });
  const [roomMode, setRoomMode] = useState<RoomMode>({ kind: 'list' });

  const refresh = useCallback(async () => {
    setCatalog(await OnboardingService.getCatalog());
    setRooms(await RoomCatalog.listRooms());
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  if (objectMode.kind !== 'list') {
    return (
      <ObjectForm
        existing={objectMode.kind === 'edit' ? objectMode.obj : undefined}
        onSave={async () => { await refresh(); setObjectMode({ kind: 'list' }); }}
        onCancel={() => setObjectMode({ kind: 'list' })}
      />
    );
  }
  if (roomMode.kind !== 'list') {
    return (
      <RoomForm
        existing={roomMode.kind === 'edit' ? roomMode.room : undefined}
        onSave={async () => { await refresh(); setRoomMode({ kind: 'list' }); }}
        onCancel={() => setRoomMode({ kind: 'list' })}
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Setup</Text>
        <Pressable style={styles.headerBtn} onPress={onClose}>
          <Text style={styles.headerBtnText}>Done</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tabBtn, tab === 'objects' && styles.tabBtnActive]}
          onPress={() => setTab('objects')}
        >
          <Text style={[styles.tabText, tab === 'objects' && styles.tabTextActive]}>Objects</Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, tab === 'rooms' && styles.tabBtnActive]}
          onPress={() => setTab('rooms')}
        >
          <Text style={[styles.tabText, tab === 'rooms' && styles.tabTextActive]}>Rooms</Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, tab === 'settings' && styles.tabBtnActive]}
          onPress={() => setTab('settings')}
        >
          <Text style={[styles.tabText, tab === 'settings' && styles.tabTextActive]}>Settings</Text>
        </Pressable>
      </View>

      {tab === 'settings' ? (
        <SettingsTab />
      ) : tab === 'objects' ? (
        <>
          <Pressable style={styles.addBtn} onPress={() => setObjectMode({ kind: 'add' })}>
            <Text style={styles.addBtnText}>+ Add object</Text>
          </Pressable>
          {catalog.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No tagged objects yet.{'\n'}Tap + to add one.</Text>
            </View>
          ) : (
            <FlatList
              data={catalog}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <CatalogRow
                  obj={item}
                  onEdit={() => setObjectMode({ kind: 'edit', obj: item })}
                  onDelete={() => {
                    Alert.alert('Delete?', `Delete "${item.display_name}"?`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          await OnboardingService.removeObject(item.id);
                          CatalogPhotos.removeForObject(item.id);
                          await refresh();
                        },
                      },
                    ]);
                  }}
                />
              )}
            />
          )}
        </>
      ) : (
        <>
          <Pressable style={styles.addBtn} onPress={() => setRoomMode({ kind: 'add' })}>
            <Text style={styles.addBtnText}>+ Add room</Text>
          </Pressable>
          {rooms.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No rooms yet.{'\n'}Tag rooms so Lola knows where you are.</Text>
            </View>
          ) : (
            <FlatList
              data={rooms}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <RoomRow
                  room={item}
                  onEdit={() => setRoomMode({ kind: 'edit', room: item })}
                  onDelete={() => {
                    Alert.alert('Delete?', `Delete room "${item.display_name}"?`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          await RoomCatalog.removeRoom(item.id);
                          await refresh();
                        },
                      },
                    ]);
                  }}
                />
              )}
            />
          )}
        </>
      )}
    </View>
  );
}

function SettingsTab() {
  const [quietCapture, setQuietCapture] = useState(false);
  useEffect(() => {
    void (async () => {
      setQuietCapture(await Settings.getBool(Settings.KEYS.quietCapture, false));
    })();
  }, []);
  const toggle = async () => {
    const next = !quietCapture;
    setQuietCapture(next);
    await Settings.setBool(Settings.KEYS.quietCapture, next);
  };
  return (
    <View style={{ padding: 16 }}>
      <Pressable style={styles.settingRow} onPress={toggle}>
        <View style={{ flex: 1 }}>
          <Text style={styles.settingLabel}>Quiet capture</Text>
          <Text style={styles.settingHint}>Mute the shutter sound when Lola takes a picture.</Text>
        </View>
        <View style={[styles.toggle, quietCapture && styles.toggleOn]}>
          <View style={[styles.toggleKnob, quietCapture && styles.toggleKnobOn]} />
        </View>
      </Pressable>
    </View>
  );
}

function RoomRow({
  room, onEdit, onDelete,
}: { room: Room; onEdit: () => void; onDelete: () => void }) {
  return (
    <View style={styles.row}>
      {room.reference_image_uri ? (
        <Image source={{ uri: room.reference_image_uri }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]} />
      )}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{room.display_name}</Text>
        {room.description ? <Text style={styles.rowDesc}>{room.description}</Text> : null}
      </View>
      <Pressable style={styles.rowBtn} onPress={onEdit}>
        <Text style={styles.rowBtnText}>Edit</Text>
      </Pressable>
      <Pressable style={[styles.rowBtn, styles.rowBtnDanger]} onPress={onDelete}>
        <Text style={styles.rowBtnText}>×</Text>
      </Pressable>
    </View>
  );
}

function RoomForm({
  existing, onSave, onCancel,
}: {
  existing?: Room;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [displayName, setDisplayName] = useState(existing?.display_name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [photos, setPhotos] = useState<string[]>([]);
  const [savedId, setSavedId] = useState<number | null>(existing?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [embedding, setEmbedding] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [downloadPct, setDownloadPct] = useState<number | null>(null);

  useEffect(() => {
    if (existing) {
      void (async () => {
        const list = await RoomCatalog.listPhotosForRoom(existing.id);
        setPhotos(list.map(p => p.uri));
      })();
    }
  }, [existing]);

  // Subscribe to the embedding model's download progress so we can surface
  // the 96MB first-run download instead of a silent "Embedding…" hang.
  useEffect(() => {
    return onDownloadProgress(p => {
      // Treat values in (0,1) as in-flight; null otherwise.
      setDownloadPct(p > 0 && p < 1 ? p : null);
    });
  }, []);

  // Lazy create — the room row is inserted the first time the user goes to
  // capture a photo. Avoids the two-step "save name first then photos" UX.
  const ensureRoomSaved = async (): Promise<number | null> => {
    if (savedId) return savedId;
    const r = await RoomCatalog.addRoom({
      display: displayName.trim(),
      description: description.trim() || undefined,
    });
    if (!r.ok) {
      Alert.alert('Could not save', r.error === 'duplicate_canonical'
        ? 'A room with this name already exists.'
        : 'Storage error. Try again.');
      return null;
    }
    setSavedId(r.value.id);
    return r.value.id;
  };

  const openCapture = async () => {
    if (!displayName.trim()) {
      Alert.alert('Name required', 'Give the room a name before adding photos.');
      return;
    }
    const id = await ensureRoomSaved();
    if (!id) return;
    setShowCapture(true);
  };

  const handleCaptured = async (result: { uri: string; base64: string }) => {
    setShowCapture(false);
    if (!savedId) return;
    setEmbedding(true);
    try {
      const r = await RoomCatalog.addPhotoForRoom(savedId, result.base64);
      if (!r.ok) {
        Alert.alert(
          'Photo failed',
          r.error === 'embed_failed'
            ? 'Could not compute embedding. Check network and try again.'
            : r.error === 'limit_reached'
              ? 'Max 5 photos per room.'
              : 'Storage error.',
        );
        return;
      }
      setPhotos([...photos, r.value.uri]);
    } finally {
      setEmbedding(false);
    }
  };

  const handleSave = async () => {
    // The room row was already inserted on the first photo. Here we just
    // commit any text edits the user made after that point.
    if (!savedId) return;
    setSaving(true);
    try {
      await RoomCatalog.updateRoom(savedId, {
        display_name: displayName.trim(),
        description: description.trim() || null,
      });
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  if (showCapture) {
    return (
      <CapturePhotoModal
        onCapture={handleCaptured}
        onCancel={() => setShowCapture(false)}
      />
    );
  }

  const canSave = displayName.trim().length > 0 && photos.length > 0 && !saving;

  return (
    <View style={styles.formRoot}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{existing ? 'Edit room' : 'New room'}</Text>
        <Pressable style={styles.headerBtn} onPress={onCancel}>
          <Text style={styles.headerBtnText}>Cancel</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Display name (Spanish)</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder='ej. "cocina", "mi dormitorio", "el baño"'
        placeholderTextColor="#666"
      />

      <Text style={styles.label}>Description (optional)</Text>
      <TextInput
        style={styles.input}
        value={description ?? ''}
        onChangeText={setDescription}
        placeholderTextColor="#666"
      />

      <Text style={styles.label}>Reference photos ({photos.length}/5)</Text>
      <Text style={styles.hint}>Take 3-5 photos from different angles so Lola can recognise it later.</Text>
      {downloadPct !== null ? (
        <Text style={styles.hint}>
          First time: downloading recognition model {(downloadPct * 100).toFixed(0)}%
        </Text>
      ) : null}
      <View style={styles.photoGrid}>
        {photos.map((uri, i) => (
          <Image key={i} source={{ uri }} style={styles.photoThumb} />
        ))}
        {photos.length < 5 ? (
          <Pressable
            style={[styles.takePhotoBtn, (embedding || !displayName.trim()) && styles.dim]}
            onPress={openCapture}
            disabled={embedding || !displayName.trim()}
          >
            <Text style={styles.takePhotoText}>
              {embedding ? (downloadPct !== null ? `${(downloadPct * 100).toFixed(0)}%` : 'Embedding…') : '+ Take photo'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        style={[styles.saveBtn, !canSave && styles.dim]}
        onPress={handleSave}
        disabled={!canSave}
      >
        <Text style={styles.saveBtnText}>Save room</Text>
      </Pressable>
    </View>
  );
}

function CatalogRow({
  obj, onEdit, onDelete,
}: { obj: CatalogObject; onEdit: () => void; onDelete: () => void }) {
  return (
    <View style={styles.row}>
      {obj.reference_image_uri ? (
        <Image source={{ uri: obj.reference_image_uri }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]} />
      )}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{obj.display_name}</Text>
        {obj.description ? <Text style={styles.rowDesc}>{obj.description}</Text> : null}
      </View>
      <Pressable style={styles.rowBtn} onPress={onEdit}>
        <Text style={styles.rowBtnText}>Edit</Text>
      </Pressable>
      <Pressable style={[styles.rowBtn, styles.rowBtnDanger]} onPress={onDelete}>
        <Text style={styles.rowBtnText}>×</Text>
      </Pressable>
    </View>
  );
}

function ObjectForm({
  existing, onSave, onCancel,
}: {
  existing?: CatalogObject;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [displayName, setDisplayName] = useState(existing?.display_name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [photos, setPhotos] = useState<string[]>(
    existing ? CatalogPhotos.listForObject(existing.id) : [],
  );
  const [savedId, setSavedId] = useState<number | null>(existing?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [showCapture, setShowCapture] = useState(false);

  // Lazy create — the object row is inserted on the first photo capture.
  // Matches the RoomForm pattern (one CTA at the bottom, no two-step save).
  const ensureObjectSaved = async (): Promise<number | null> => {
    if (savedId) return savedId;
    const r = await OnboardingService.addObject({
      display: displayName.trim(),
      description: description.trim() || undefined,
    });
    if (!r.ok) {
      Alert.alert('Could not save', r.error === 'duplicate_canonical'
        ? 'An object with this name already exists.'
        : 'Storage error. Try again.');
      return null;
    }
    setSavedId(r.value.id);
    return r.value.id;
  };

  const openCapture = async () => {
    if (!displayName.trim()) {
      Alert.alert('Name required', 'Give the object a name before adding photos.');
      return;
    }
    const id = await ensureObjectSaved();
    if (!id) return;
    setShowCapture(true);
  };

  const handleCaptured = async (result: { uri: string; base64: string }) => {
    setShowCapture(false);
    if (!savedId) return;
    const r = CatalogPhotos.saveBase64ForObject(savedId, result.base64);
    if (!r.ok) {
      Alert.alert('Capture failed', r.error);
      return;
    }
    const wasEmpty = photos.length === 0;
    setPhotos([...photos, r.value]);
    if (wasEmpty) {
      await OnboardingService.updateObject(savedId, { reference_image_uri: r.value });
    }
  };

  const handleSave = async () => {
    if (!savedId) return;
    setSaving(true);
    try {
      await OnboardingService.updateObject(savedId, {
        display_name: displayName.trim(),
        description: description.trim() || null,
        reference_image_uri: photos[0] ?? existing?.reference_image_uri,
      });
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  if (showCapture) {
    return (
      <CapturePhotoModal
        onCapture={handleCaptured}
        onCancel={() => setShowCapture(false)}
      />
    );
  }

  const canSave = displayName.trim().length > 0 && photos.length > 0 && !saving;

  return (
    <View style={styles.formRoot}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{existing ? 'Edit object' : 'New object'}</Text>
        <Pressable style={styles.headerBtn} onPress={onCancel}>
          <Text style={styles.headerBtnText}>Cancel</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Display name (Spanish)</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholderTextColor="#666"
      />

      <Text style={styles.label}>Description (optional, Spanish)</Text>
      <TextInput
        style={styles.input}
        value={description ?? ''}
        onChangeText={setDescription}
        placeholderTextColor="#666"
      />

      <Text style={styles.label}>Reference photos ({photos.length}/3)</Text>
      <Text style={styles.hint}>At least one photo so the catalog can show a thumbnail and the model can disambiguate.</Text>
      <View style={styles.photoGrid}>
        {photos.map((uri, i) => (
          <Image key={i} source={{ uri }} style={styles.photoThumb} />
        ))}
        {photos.length < 3 ? (
          <Pressable
            style={[styles.takePhotoBtn, !displayName.trim() && styles.dim]}
            onPress={openCapture}
            disabled={!displayName.trim()}
          >
            <Text style={styles.takePhotoText}>+ Take photo</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        style={[styles.saveBtn, !canSave && styles.dim]}
        onPress={handleSave}
        disabled={!canSave}
      >
        <Text style={styles.saveBtnText}>Save object</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#222' },
  formRoot: { flex: 1, backgroundColor: '#222', padding: 16 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#333',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '600' },
  headerBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  headerBtnText: { color: '#4af', fontSize: 16 },
  addBtn: { backgroundColor: '#4af', margin: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { color: '#888', fontSize: 16, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#333' },
  thumb: { width: 56, height: 56, borderRadius: 8, marginRight: 12 },
  thumbEmpty: { backgroundColor: '#444' },
  rowText: { flex: 1 },
  rowTitle: { color: '#fff', fontSize: 16, fontWeight: '500' },
  rowDesc: { color: '#888', fontSize: 13, marginTop: 2 },
  rowBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#333', borderRadius: 6, marginLeft: 8 },
  rowBtnDanger: { backgroundColor: '#a33' },
  rowBtnText: { color: '#fff', fontSize: 14 },
  label: { color: '#aaa', fontSize: 13, marginTop: 16, marginBottom: 6 },
  input: { backgroundColor: '#1a1a1a', color: '#fff', padding: 12, borderRadius: 6, fontSize: 16 },
  saveBtn: { backgroundColor: '#4af', marginTop: 24, padding: 16, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  dim: { opacity: 0.5 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  photoThumb: { width: 80, height: 80, borderRadius: 6, marginRight: 8, marginBottom: 8 },
  takePhotoBtn: {
    width: 80, height: 80, borderRadius: 6, backgroundColor: '#333',
    alignItems: 'center', justifyContent: 'center',
  },
  takePhotoText: { color: '#aaa', fontSize: 12, textAlign: 'center' },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#333',
    borderRadius: 6,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: '#4af' },
  tabText: { color: '#aaa', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  hint: { color: '#888', fontSize: 12, marginTop: -2, marginBottom: 6 },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: '#1a1a1a', borderRadius: 8, marginBottom: 12,
  },
  settingLabel: { color: '#fff', fontSize: 16, fontWeight: '500' },
  settingHint: { color: '#888', fontSize: 12, marginTop: 4 },
  toggle: {
    width: 44, height: 24, borderRadius: 12, backgroundColor: '#555',
    padding: 2, justifyContent: 'center',
  },
  toggleOn: { backgroundColor: '#4af' },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toggleKnobOn: { transform: [{ translateX: 20 }] },
});
