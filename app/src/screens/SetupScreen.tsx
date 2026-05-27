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
import type { CatalogObject } from '@/services/OnboardingService';

type Mode =
  | { kind: 'list' }
  | { kind: 'add' }
  | { kind: 'edit'; obj: CatalogObject };

export function SetupScreen({ onClose }: { onClose: () => void }) {
  const [catalog, setCatalog] = useState<CatalogObject[]>([]);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });

  const refresh = useCallback(async () => {
    setCatalog(await OnboardingService.getCatalog());
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  if (mode.kind === 'add' || mode.kind === 'edit') {
    return (
      <ObjectForm
        existing={mode.kind === 'edit' ? mode.obj : undefined}
        onSave={async () => { await refresh(); setMode({ kind: 'list' }); }}
        onCancel={() => setMode({ kind: 'list' })}
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Setup — tagged objects</Text>
        <Pressable style={styles.headerBtn} onPress={onClose}>
          <Text style={styles.headerBtnText}>Done</Text>
        </Pressable>
      </View>

      <Pressable style={styles.addBtn} onPress={() => setMode({ kind: 'add' })}>
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
              onEdit={() => setMode({ kind: 'edit', obj: item })}
              onDelete={() => {
                Alert.alert(
                  'Delete?',
                  `Delete "${item.display_name}"?`,
                  [
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
                  ],
                );
              }}
            />
          )}
        />
      )}
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

  const handleSave = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      if (existing) {
        await OnboardingService.updateObject(existing.id, {
          display_name: displayName.trim(),
          description: description.trim() || null,
          reference_image_uri: photos[0] ?? existing.reference_image_uri,
        });
        await onSave();
      } else {
        const r = await OnboardingService.addObject({
          display: displayName.trim(),
          description: description.trim() || undefined,
        });
        if (!r.ok) {
          Alert.alert('Could not save', r.error === 'duplicate_canonical'
            ? 'An object with this name already exists.'
            : 'Storage error. Try again.');
          return;
        }
        setSavedId(r.value.id);
        // Stay in the form so the user can take photos.
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTakePhoto = async () => {
    if (!savedId) {
      Alert.alert('Save first', 'Save the object before adding photos.');
      return;
    }
    const r = await CatalogPhotos.captureForObject(savedId);
    if (!r.ok) {
      Alert.alert('Capture failed', r.error);
      return;
    }
    const wasEmpty = photos.length === 0;
    setPhotos([...photos, r.value]);
    if (wasEmpty) {
      // First photo becomes the reference image.
      await OnboardingService.updateObject(savedId, { reference_image_uri: r.value });
    }
  };

  const handleDone = async () => {
    if (savedId && photos[0]) {
      await OnboardingService.updateObject(savedId, { reference_image_uri: photos[0] });
    }
    await onSave();
  };

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

      <Pressable
        style={[styles.saveBtn, (saving || !displayName.trim()) && styles.dim]}
        onPress={savedId ? handleDone : handleSave}
        disabled={saving || !displayName.trim()}
      >
        <Text style={styles.saveBtnText}>{savedId ? 'Done' : 'Save object'}</Text>
      </Pressable>

      {savedId ? (
        <>
          <Text style={styles.label}>Photos ({photos.length}/3)</Text>
          <View style={styles.photoGrid}>
            {photos.map((uri, i) => (
              <Image key={i} source={{ uri }} style={styles.photoThumb} />
            ))}
            {photos.length < 3 ? (
              <Pressable style={styles.takePhotoBtn} onPress={handleTakePhoto}>
                <Text style={styles.takePhotoText}>+ Take photo</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}
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
});
