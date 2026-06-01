// FR-3 SetupScreen — caregiver tool. Recreates the handoff caregiver surface:
// segmented tabs, list rows, empty states, object/room forms, success/error
// toast, plus a Language selector. UI text follows the device language with a
// manual override (see @/i18n); the dad-facing surface stays Spanish. Data
// logic (OnboardingService / RoomCatalog / CatalogPhotos / Settings) unchanged.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Application from 'expo-application';
import type * as Speech from 'expo-speech';
import { listSpanishVoices, speakPreview, RATE_DEFAULT, PITCH_DEFAULT } from '@/adapters/tts';
import { Slider } from '@/components/Slider';
import { COPY } from '@/services';
import * as OnboardingService from '@/services/OnboardingService';
import * as CatalogPhotos from '@/services/CatalogPhotos';
import * as RoomCatalog from '@/services/RoomCatalog';
import * as MemoryService from '@/services/MemoryService';
import * as Settings from '@/services/Settings';
import type { CatalogObject } from '@/services/OnboardingService';
import type { Room } from '@/services/RoomCatalog';
import { CapturePhotoModal } from './CapturePhotoModal';
import { onDownloadProgress } from '@/adapters/embeddings';
import { SetupHeader } from '@/components/SetupHeader';
import { Tabs } from '@/components/Tabs';
import { ListRow } from '@/components/ListRow';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Field } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { MugIcon } from '@/components/MugIcon';
import { Toast, type ToastMessage } from '@/components/Toast';
import { useSetupStrings, setLang, useLang, type Lang } from '@/i18n';
import { color, radius, fontFamily, shadow } from '@/theme/tokens';
import { TOP_INSET, BOTTOM_INSET } from '@/theme/insets';
import type { SetupCopy } from '@/i18n/setupStrings';

// Read once at module load — these are synchronous native getters.
const APP_VERSION = Application.nativeApplicationVersion ?? '0.0.0';
const APP_BUILD = Application.nativeBuildVersion ?? '—';

type Tab = 'objects' | 'rooms' | 'settings';
type ObjectMode = { kind: 'list' } | { kind: 'add' } | { kind: 'edit'; obj: CatalogObject };
type RoomMode = { kind: 'list' } | { kind: 'add' } | { kind: 'edit'; room: Room };

export function SetupScreen({ onClose }: { onClose: () => void }) {
  const t = useSetupStrings();
  const [tab, setTab] = useState<Tab>('objects');
  const [catalog, setCatalog] = useState<CatalogObject[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [seenRooms, setSeenRooms] = useState<Record<number, string>>({});
  const [objectMode, setObjectMode] = useState<ObjectMode>({ kind: 'list' });
  const [roomMode, setRoomMode] = useState<RoomMode>({ kind: 'list' });
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // One-time caregiver intro card on first Setup open (item #6).
  const [showIntro, setShowIntro] = useState(false);
  useEffect(() => {
    void Settings.getBool(Settings.KEYS.caregiverIntroSeen, false).then(seen => {
      if (!seen) setShowIntro(true);
    });
  }, []);
  const dismissIntro = () => {
    setShowIntro(false);
    void Settings.setBool(Settings.KEYS.caregiverIntroSeen, true);
  };

  const refresh = useCallback(async () => {
    const cat = await OnboardingService.getCatalog();
    setCatalog(cat);
    setRooms(await RoomCatalog.listRooms());
    setSeenRooms(await MemoryService.lastSeenRooms(cat.map(o => o.id)));
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  if (objectMode.kind !== 'list') {
    return (
      <ObjectForm
        existing={objectMode.kind === 'edit' ? objectMode.obj : undefined}
        onSave={async (name) => { await refresh(); setObjectMode({ kind: 'list' }); setToast({ text: t.savedQuote(name) }); }}
        onCancel={() => setObjectMode({ kind: 'list' })}
        onError={() => setToast({ text: t.saveFailed, type: 'error' })}
      />
    );
  }
  if (roomMode.kind !== 'list') {
    return (
      <RoomForm
        existing={roomMode.kind === 'edit' ? roomMode.room : undefined}
        onSave={async (name) => { await refresh(); setRoomMode({ kind: 'list' }); setToast({ text: t.savedQuote(name) }); }}
        onCancel={() => setRoomMode({ kind: 'list' })}
        onError={() => setToast({ text: t.saveFailed, type: 'error' })}
      />
    );
  }

  const objectSubtitle = (obj: CatalogObject): string => {
    const room = seenRooms[obj.id];
    const seen = room ? t.lastSeen(room).toLowerCase() : t.neverSeen;
    if (obj.description) return room ? `${obj.description} · ${seen}` : obj.description;
    return seen;
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SetupHeader title={t.setup} rightLabel={t.done} onRightPress={onClose} />

      <View style={styles.tabsWrap}>
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { key: 'objects', label: t.objects, icon: 'objects', renderIcon: ({ size, color: c }) => <MugIcon size={size} color={c} /> },
            { key: 'rooms', label: t.rooms, icon: 'rooms' },
            { key: 'settings', label: t.settings, icon: 'settings' },
          ]}
        />
      </View>

      {tab === 'settings' ? (
        <SettingsTab />
      ) : tab === 'objects' ? (
        catalog.length === 0 ? (
          <EmptyState kind="objects" onAdd={() => setObjectMode({ kind: 'add' })} />
        ) : (
          <>
            <View style={styles.addWrap}>
              <PrimaryButton label={t.addObject} leadingIcon="add" onPress={() => setObjectMode({ kind: 'add' })} />
            </View>
            <ScrollView contentContainerStyle={styles.listContent}>
              {catalog.map(item => (
                <ListRow
                  key={item.id}
                  thumbUri={item.reference_image_uri}
                  title={item.display_name}
                  subtitle={objectSubtitle(item)}
                  seenIcon
                  onEdit={() => setObjectMode({ kind: 'edit', obj: item })}
                  onDelete={() => confirmDelete(t, item.display_name, async () => {
                    await OnboardingService.removeObject(item.id);
                    CatalogPhotos.removeForObject(item.id);
                    await refresh();
                    setToast({ text: t.deleted });
                  })}
                />
              ))}
            </ScrollView>
          </>
        )
      ) : (
        rooms.length === 0 ? (
          <EmptyState kind="rooms" onAdd={() => setRoomMode({ kind: 'add' })} />
        ) : (
          <>
            <View style={styles.addWrap}>
              <PrimaryButton label={t.addRoom} leadingIcon="add" onPress={() => setRoomMode({ kind: 'add' })} />
            </View>
            <ScrollView contentContainerStyle={styles.listContent}>
              {rooms.map(item => (
                <ListRow
                  key={item.id}
                  thumbUri={item.reference_image_uri}
                  title={item.display_name}
                  subtitle={item.description || undefined}
                  onEdit={() => setRoomMode({ kind: 'edit', room: item })}
                  onDelete={() => confirmDelete(t, item.display_name, async () => {
                    await RoomCatalog.removeRoom(item.id);
                    await refresh();
                    setToast({ text: t.deleted });
                  })}
                />
              ))}
            </ScrollView>
          </>
        )
      )}

      <Toast message={toast} onHide={() => setToast(null)} />

      {/* One-time caregiver intro — an overlay popup over the whole screen.
          Tap anywhere (scrim or the card) to dismiss; the CTA is there too. */}
      {showIntro && (
        <Pressable style={styles.introOverlay} onPress={dismissIntro} accessibilityRole="button">
          <View style={styles.introCard}>
            <Text style={styles.introTitle}>{t.introTitle}</Text>
            <Text style={styles.introBody}>{t.introBody}</Text>
            <Pressable style={styles.introBtn} onPress={dismissIntro} accessibilityRole="button">
              <Text style={styles.introBtnText}>{t.introDismiss}</Text>
            </Pressable>
          </View>
        </Pressable>
      )}
    </View>
  );
}

function confirmDelete(t: SetupCopy, name: string, onConfirm: () => void) {
  Alert.alert(t.deleteConfirmTitle, t.deleteConfirmBody(name), [
    { text: t.cancel, style: 'cancel' },
    { text: t.delete, style: 'destructive', onPress: onConfirm },
  ]);
}

// ---------------- EMPTY STATE ----------------
function EmptyState({ kind, onAdd }: { kind: 'objects' | 'rooms'; onAdd: () => void }) {
  const t = useSetupStrings();
  const room = kind === 'rooms';
  return (
    <View style={styles.empty}>
      <View style={styles.emptyTile}>
        {room
          ? <Icon name="rooms" size={48} color={color.primary[500]} />
          : <MugIcon size={48} color={color.primary[500]} />}
      </View>
      <Text style={styles.emptyTitle}>{room ? t.emptyRoomTitle : t.emptyObjTitle}</Text>
      <Text style={styles.emptyBody}>{room ? t.emptyRoomBody : t.emptyObjBody}</Text>
      <View style={styles.emptyCta}>
        <PrimaryButton
          label={room ? t.emptyRoomCta : t.emptyObjCta}
          leadingIcon="add"
          onPress={onAdd}
        />
      </View>
    </View>
  );
}

// ---------------- SETTINGS ----------------
function SettingsTab() {
  const t = useSetupStrings();
  const lang = useLang();
  const [quietCapture, setQuietCapture] = useState(false);
  const [heartbeatOn, setHeartbeatOn] = useState(false);
  const [userName, setUserName] = useState('');
  const [voices, setVoices] = useState<Speech.Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [rate, setRate] = useState(RATE_DEFAULT);
  const [pitch, setPitch] = useState(PITCH_DEFAULT);

  useEffect(() => {
    void (async () => {
      setQuietCapture(await Settings.getBool(Settings.KEYS.quietCapture, false));
      setHeartbeatOn(await Settings.getBool(Settings.KEYS.idleHeartbeat, true));
      setUserName(await Settings.getString(Settings.KEYS.userName, ''));
      setSelectedVoice(await Settings.getString(Settings.KEYS.voice, ''));
      const r = parseFloat(await Settings.getString(Settings.KEYS.ttsRate, ''));
      const p = parseFloat(await Settings.getString(Settings.KEYS.ttsPitch, ''));
      if (Number.isFinite(r) && r > 0) setRate(r);
      if (Number.isFinite(p) && p > 0) setPitch(p);
      setVoices(await listSpanishVoices());
    })();
  }, []);

  // Refs hold the live values so the release-preview uses the latest slider
  // positions (React state may not have committed yet at release time).
  const rateRef = useRef(rate);
  const pitchRef = useRef(pitch);
  const voiceRef = useRef(selectedVoice);
  rateRef.current = rate;
  pitchRef.current = pitch;
  voiceRef.current = selectedVoice;

  const changeRate = (v: number) => { rateRef.current = v; setRate(v); void Settings.setString(Settings.KEYS.ttsRate, String(v)); };
  const changePitch = (v: number) => { pitchRef.current = v; setPitch(v); void Settings.setString(Settings.KEYS.ttsPitch, String(v)); };
  const previewTuning = () => speakPreview(COPY.greeting, { voice: voiceRef.current, rate: rateRef.current, pitch: pitchRef.current });
  const changeName = (v: string) => { setUserName(v); void Settings.setString(Settings.KEYS.userName, v.trim()); };

  const toggle = async () => {
    const next = !quietCapture;
    setQuietCapture(next);
    await Settings.setBool(Settings.KEYS.quietCapture, next);
  };
  const toggleHeartbeat = async () => {
    const next = !heartbeatOn;
    setHeartbeatOn(next);
    await Settings.setBool(Settings.KEYS.idleHeartbeat, next);
  };

  const selectVoice = (id: string) => {
    setSelectedVoice(id);
    void Settings.setString(Settings.KEYS.voice, id);
    // Preview the choice immediately with Lola's greeting line.
    speakPreview(COPY.greeting, { voice: id, rate, pitch });
  };

  // De-dupe by name+language: some engines expose the same voice under several
  // identifiers (network/local variants) that read as identical to the user.
  const seenVoiceLabels = new Set<string>();
  const voiceRows: { id: string; label: string }[] = [{ id: '', label: t.voiceDefault }];
  for (const v of voices) {
    const label = `${v.name} · ${v.language}`;
    if (seenVoiceLabels.has(label)) continue;
    seenVoiceLabels.add(label);
    voiceRows.push({ id: v.identifier, label });
  }

  return (
    <View style={styles.settingsWrap}>
      <ScrollView contentContainerStyle={styles.settingsScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Your name */}
        <View style={styles.settingCard}>
          <Field label={t.yourName} value={userName} onChangeText={changeName} placeholder={t.yourNamePh} hint={t.yourNameHint} />
        </View>

        {/* Language */}
        <View style={styles.settingCard}>
          <Text style={styles.settingLabel}>{t.language}</Text>
          <View style={styles.segment}>
            {(['es', 'en'] as Lang[]).map(code => {
              const active = lang === code;
              return (
                <Pressable
                  key={code}
                  onPress={() => setLang(code)}
                  style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {code === 'es' ? t.langSpanish : t.langEnglish}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Voice */}
        <View style={styles.settingCard}>
          <Text style={styles.settingLabel}>{t.voice}</Text>
          <Text style={styles.settingHint}>{t.voiceHint}</Text>
          {voices.length === 0 ? (
            <Text style={[styles.settingHint, { marginTop: 10 }]}>{t.noVoices}</Text>
          ) : (
            <View style={styles.voiceList}>
              {voiceRows.map(row => {
                const active = selectedVoice === row.id;
                return (
                  <Pressable key={row.id || 'default'} onPress={() => selectVoice(row.id)} style={styles.voiceRow}>
                    <Text style={[styles.voiceName, active && styles.voiceNameActive]} numberOfLines={1}>
                      {row.label}
                    </Text>
                    {active && <Icon name="check" size={20} color={color.primary[500]} />}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Voice tuning — speed + pitch for the system voice. */}
        <View style={styles.settingCard}>
          <Text style={styles.settingLabel}>{t.voiceTuning}</Text>
          <Text style={styles.settingHint}>{t.voiceTuningHint}</Text>
          <Slider
            label={t.speed}
            value={rate}
            min={0.5}
            max={1.6}
            step={0.05}
            onChange={changeRate}
            onComplete={previewTuning}
            format={v => `${v.toFixed(2)}×`}
          />
          <Slider
            label={t.pitch}
            value={pitch}
            min={0.5}
            max={1.6}
            step={0.05}
            onChange={changePitch}
            onComplete={previewTuning}
            format={v => `${v.toFixed(2)}×`}
          />
        </View>

        {/* Quiet capture */}
        <Pressable style={styles.settingRow} onPress={toggle}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>{t.quietCapture}</Text>
            <Text style={styles.settingHint}>{t.quietCaptureHint}</Text>
          </View>
          <View style={[styles.toggle, quietCapture && styles.toggleOn]}>
            <View style={[styles.toggleKnob, quietCapture && styles.toggleKnobOn]} />
          </View>
        </Pressable>

        {/* Idle heartbeat */}
        <Pressable style={styles.settingRow} onPress={toggleHeartbeat}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>{t.heartbeat}</Text>
            <Text style={styles.settingHint}>{t.heartbeatHint}</Text>
          </View>
          <View style={[styles.toggle, heartbeatOn && styles.toggleOn]}>
            <View style={[styles.toggleKnob, heartbeatOn && styles.toggleKnobOn]} />
          </View>
        </Pressable>
      </ScrollView>

      <Text style={styles.version}>Lola v{APP_VERSION} (build {APP_BUILD})</Text>
    </View>
  );
}

// ---------------- OBJECT FORM ----------------
function ObjectForm({
  existing, onSave, onCancel, onError,
}: {
  existing?: CatalogObject;
  onSave: (name: string) => void | Promise<void>;
  onCancel: () => void;
  onError: () => void;
}) {
  const t = useSetupStrings();
  const [displayName, setDisplayName] = useState(existing?.display_name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [photos, setPhotos] = useState<string[]>(existing ? CatalogPhotos.listForObject(existing.id) : []);
  const [savedId, setSavedId] = useState<number | null>(existing?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const [capture, setCapture] = useState<false | 'add' | 'replace0'>(false);
  const MAX = 3;
  const full = photos.length >= MAX;

  const ensureSaved = async (): Promise<number | null> => {
    if (savedId) return savedId;
    const r = await OnboardingService.addObject({
      display: displayName.trim(),
      description: description.trim() || undefined,
    });
    if (!r.ok) { onError(); return null; }
    setSavedId(r.value.id);
    return r.value.id;
  };

  const openCapture = async (slot: 'add' | 'replace0') => {
    if (!displayName.trim()) { setTried(true); return; }
    const id = await ensureSaved();
    if (!id) return;
    setCapture(slot);
  };

  const handleCaptured = async (result: { uri: string; base64: string }) => {
    const slot = capture;
    setCapture(false);
    if (!savedId) return;
    const r = CatalogPhotos.saveBase64ForObject(savedId, result.base64);
    if (!r.ok) { onError(); return; }
    let next: string[];
    if (slot === 'replace0') next = [r.value, ...photos.slice(1)];
    else next = [...photos, r.value];
    setPhotos(next);
    if (slot !== 'replace0' && photos.length === 0) {
      await OnboardingService.updateObject(savedId, { reference_image_uri: r.value });
    } else if (slot === 'replace0') {
      await OnboardingService.updateObject(savedId, { reference_image_uri: next[0] });
    }
  };

  const handleSave = async () => {
    if (!displayName.trim() || photos.length === 0) { setTried(true); return; }
    if (!savedId) { const id = await ensureSaved(); if (!id) return; }
    setSaving(true);
    try {
      await OnboardingService.updateObject(savedId!, {
        display_name: displayName.trim(),
        description: description.trim() || null,
        reference_image_uri: photos[0] ?? existing?.reference_image_uri,
      });
      await onSave(displayName.trim());
    } finally { setSaving(false); }
  };

  if (capture) {
    return <CapturePhotoModal hint={t.capHintObj} onCapture={handleCaptured} onCancel={() => setCapture(false)} />;
  }

  return (
    <View style={styles.formRoot}>
      <StatusBar style="dark" />
      <SetupHeader title={existing ? t.editObject : t.newObject} onBack={onCancel} />
      <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
        <Field
          label={t.fName}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={t.phObjName}
          error={tried && !displayName.trim() ? t.requiredName : null}
        />
        <View style={{ height: 16 }} />
        <Field label={t.fDesc} value={description} onChangeText={setDescription} placeholder={t.phObjDesc} />

        <View style={styles.photoSection}>
          <View style={styles.photoHead}>
            <Text style={styles.photoLabel}>{t.fRefPhoto} <Text style={styles.req}>*</Text></Text>
            <Text style={[styles.counter, full && styles.counterDone]}>{photos.length}/{MAX}</Text>
          </View>
          <Text style={styles.photoSub}>{t.fRefPhotoSub}</Text>

          {photos.length === 0 ? (
            <Pressable
              onPress={() => openCapture('add')}
              style={[styles.dropTile, { borderColor: tried ? color.status.error : color.neutral[300] }]}
            >
              <View style={styles.dropCircle}><Icon name="photo" size={28} color={color.primary[500]} /></View>
              <Text style={styles.dropLabel}>{t.takePhoto}</Text>
            </Pressable>
          ) : (
            <>
              <View style={styles.mainPhotoWrap}>
                <Image source={{ uri: photos[0] }} style={styles.mainPhoto} />
                <View style={styles.badge}><Text style={styles.badgeText}>{t.reference}</Text></View>
                <Pressable style={styles.retakePill} onPress={() => openCapture('replace0')}>
                  <Icon name="retake" size={16} color="#fff" />
                  <Text style={styles.retakeText}>{t.retake}</Text>
                </Pressable>
              </View>

              <Text style={styles.moreTitle}>{t.objMore}</Text>
              <Text style={styles.moreSub}>{t.objMoreSub}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbStrip}>
                {photos.slice(1).map((uri, i) => (
                  <View key={uri + i} style={styles.thumbCell}>
                    <Image source={{ uri }} style={styles.thumbImg} />
                    <Pressable style={styles.deleteX} onPress={() => setPhotos(photos.filter((_, j) => j !== i + 1))}>
                      <Icon name="cancel" size={13} color="#fff" />
                    </Pressable>
                  </View>
                ))}
                {!full && (
                  <Pressable style={styles.addThumb} onPress={() => openCapture('add')}>
                    <Icon name="add" size={24} color={color.primary[500]} />
                    <Text style={styles.addThumbText}>{t.add}</Text>
                  </Pressable>
                )}
              </ScrollView>
              <Text style={styles.footnote}>{t.objFirstIsRef}</Text>
            </>
          )}
          {tried && photos.length === 0 ? <ErrText text={t.requiredPhoto} /> : null}
        </View>
      </ScrollView>
      <FormFooter>
        <PrimaryButton label={t.saveObject} disabled={saving} onPress={handleSave} />
      </FormFooter>
    </View>
  );
}

// ---------------- ROOM FORM ----------------
function RoomForm({
  existing, onSave, onCancel, onError,
}: {
  existing?: Room;
  onSave: (name: string) => void | Promise<void>;
  onCancel: () => void;
  onError: () => void;
}) {
  const t = useSetupStrings();
  const [displayName, setDisplayName] = useState(existing?.display_name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [photos, setPhotos] = useState<string[]>([]);
  const [savedId, setSavedId] = useState<number | null>(existing?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [embedding, setEmbedding] = useState(false);
  const [tried, setTried] = useState(false);
  const [capture, setCapture] = useState(false);
  const [downloadPct, setDownloadPct] = useState<number | null>(null);
  const MAX = 5;
  const full = photos.length >= MAX;

  useEffect(() => {
    if (existing) {
      void (async () => {
        const list = await RoomCatalog.listPhotosForRoom(existing.id);
        setPhotos(list.map(p => p.uri));
      })();
    }
  }, [existing]);

  useEffect(() => onDownloadProgress(p => setDownloadPct(p > 0 && p < 1 ? p : null)), []);

  const ensureSaved = async (): Promise<number | null> => {
    if (savedId) return savedId;
    const r = await RoomCatalog.addRoom({ display: displayName.trim(), description: description.trim() || undefined });
    if (!r.ok) { onError(); return null; }
    setSavedId(r.value.id);
    return r.value.id;
  };

  const openCapture = async () => {
    if (!displayName.trim()) { setTried(true); return; }
    const id = await ensureSaved();
    if (!id) return;
    setCapture(true);
  };

  const handleCaptured = async (result: { uri: string; base64: string }) => {
    setCapture(false);
    if (!savedId) return;
    setEmbedding(true);
    try {
      const r = await RoomCatalog.addPhotoForRoom(savedId, result.base64);
      if (!r.ok) {
        if (r.error === 'limit_reached') return;
        onError();
        return;
      }
      setPhotos(prev => [...prev, r.value.uri]);
    } finally { setEmbedding(false); }
  };

  const handleSave = async () => {
    if (!displayName.trim() || photos.length === 0) { setTried(true); return; }
    if (!savedId) { const id = await ensureSaved(); if (!id) return; }
    setSaving(true);
    try {
      await RoomCatalog.updateRoom(savedId!, {
        display_name: displayName.trim(),
        description: description.trim() || null,
      });
      await onSave(displayName.trim());
    } finally { setSaving(false); }
  };

  if (capture) {
    return <CapturePhotoModal hint={t.capHintRoom} onCapture={handleCaptured} onCancel={() => setCapture(false)} />;
  }

  const progress = photos.length === 0 ? null
    : full ? t.photosFull
      : photos.length < 3 ? t.photosLow(photos.length) : t.photosOk(photos.length);

  return (
    <View style={styles.formRoot}>
      <StatusBar style="dark" />
      <SetupHeader title={existing ? t.editRoom : t.newRoom} onBack={onCancel} />
      <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
        <Field
          label={t.fName}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={t.phRoomName}
          error={tried && !displayName.trim() ? t.requiredName : null}
        />
        <View style={{ height: 16 }} />
        <Field label={t.fDesc} value={description} onChangeText={setDescription} placeholder={t.phRoomDesc} />

        <View style={styles.photoSection}>
          <View style={styles.photoHead}>
            <Text style={styles.photoLabel}>{t.refPhotos} <Text style={styles.req}>*</Text></Text>
            <Text style={[styles.counter, full && styles.counterDone]}>{photos.length}/{MAX}</Text>
          </View>
          <Text style={styles.photoSub}>{t.refPhotosSub}</Text>
          {downloadPct !== null ? (
            <View style={styles.downloadBanner}>
              <Icon name="lastSeen" size={16} color={color.primary[700]} />
              <Text style={styles.downloadText}>{t.modelDownloading(Math.round(downloadPct * 100))}</Text>
            </View>
          ) : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roomStrip}>
            {photos.map((uri, i) => (
              <View key={uri + i} style={styles.roomCell}>
                <Image source={{ uri }} style={styles.roomImg} />
                {i === 0 && <View style={styles.coverBadge}><Text style={styles.coverText}>{t.cover}</Text></View>}
                <Pressable style={styles.deleteX} onPress={() => setPhotos(photos.filter((_, j) => j !== i))}>
                  <Icon name="cancel" size={13} color="#fff" />
                </Pressable>
              </View>
            ))}
            {!full && (
              <Pressable
                style={[styles.roomAddTile, { borderColor: tried && photos.length === 0 ? color.status.error : color.neutral[300] }, embedding && styles.dim]}
                onPress={openCapture}
                disabled={embedding}
              >
                <Icon name="add" size={28} color={color.primary[500]} />
                <Text style={styles.addThumbText}>{embedding ? '…' : t.takePhoto}</Text>
              </Pressable>
            )}
          </ScrollView>

          {progress && (
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${(photos.length / MAX) * 100}%`, backgroundColor: full ? color.status.success : color.primary[500] }]} />
              </View>
              <Text style={[styles.progressLabel, { color: full ? color.status.success : color.text.medium }]}>{`${photos.length}/${MAX}`}</Text>
            </View>
          )}
          {progress && <Text style={[styles.progressCopy, { color: full ? color.status.success : color.text.medium }]}>{progress}</Text>}
          {photos.length > 0 && <Text style={styles.footnote}>{t.firstIsThumb}</Text>}
          {tried && photos.length === 0 ? <ErrText text={t.requiredPhoto} /> : null}
        </View>
      </ScrollView>
      <FormFooter>
        <PrimaryButton label={t.saveRoom} disabled={saving} onPress={handleSave} />
      </FormFooter>
    </View>
  );
}

// ---------------- small helpers ----------------
function ErrText({ text }: { text: string }) {
  return (
    <View style={styles.errRow}>
      <Icon name="error" size={14} color={color.status.error} />
      <Text style={styles.errText}>{text}</Text>
    </View>
  );
}
function FormFooter({ children }: { children: React.ReactNode }) {
  return <View style={styles.footer}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.neutral.canvas },
  formRoot: { flex: 1, backgroundColor: color.neutral.canvas },
  tabsWrap: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10 },
  addWrap: { paddingHorizontal: 18, paddingBottom: 12 },
  introOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 100, elevation: 100,
    backgroundColor: 'rgba(12,13,15,0.45)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  introCard: {
    width: '100%', maxWidth: 420, padding: 22, gap: 12,
    backgroundColor: color.neutral.white, borderRadius: radius.xl,
    ...shadow('lg'),
  },
  introTitle: { fontSize: 20, fontFamily: fontFamily.bold, fontWeight: '700', color: color.text.high },
  introBody: { fontSize: 15, fontFamily: fontFamily.regular, color: color.text.medium, lineHeight: 21 },
  introBtn: {
    alignSelf: 'flex-start', backgroundColor: color.primary[50],
    borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 9, marginTop: 2,
  },
  introBtnText: { color: color.primary[600], fontSize: 15, fontFamily: fontFamily.bold, fontWeight: '700' },
  listContent: { paddingHorizontal: 18, paddingBottom: 24 + BOTTOM_INSET, gap: 10 },

  // The empty block fills the area below the header + tabs, so a plain center
  // sits below the true screen middle. Bias it up by ~the top-chrome height
  // (header minus its status-bar inset ≈ 60 + tabs ≈ 70) so it reads centered.
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 36, paddingBottom: TOP_INSET + 130,
  },
  emptyTile: {
    width: 96, height: 96, borderRadius: radius['2xl'] - 2, backgroundColor: color.primary[50],
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  emptyTitle: { fontSize: 24, fontFamily: fontFamily.extrabold, fontWeight: '800', color: color.text.high, marginBottom: 10, letterSpacing: -0.3 },
  emptyBody: { fontSize: 15, fontFamily: fontFamily.regular, color: color.text.medium, lineHeight: 23, textAlign: 'center', marginBottom: 28 },
  emptyCta: { width: '100%', maxWidth: 320 },

  settingsWrap: { flex: 1, padding: 18, paddingBottom: 18 + BOTTOM_INSET },
  settingsScroll: { gap: 12, paddingBottom: 12 },
  version: { marginTop: 12, textAlign: 'center', fontSize: 12.5, fontFamily: fontFamily.medium, color: color.text.low },
  voiceList: { marginTop: 10, borderTopWidth: 1, borderTopColor: color.neutral.border },
  voiceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, gap: 12,
    borderBottomWidth: 1, borderBottomColor: color.neutral.border,
  },
  voiceName: { flex: 1, fontSize: 15, fontFamily: fontFamily.medium, color: color.text.high },
  voiceNameActive: { fontFamily: fontFamily.bold, fontWeight: '700', color: color.primary[500] },
  settingCard: {
    padding: 16, backgroundColor: color.neutral.white,
    borderWidth: 1, borderColor: color.neutral.border, borderRadius: radius.lg - 2,
  },
  segment: {
    flexDirection: 'row', gap: 6, marginTop: 12,
    backgroundColor: color.neutral.sunken, padding: 5, borderRadius: radius.md,
  },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: color.neutral.white },
  segmentText: { fontFamily: fontFamily.bold, fontWeight: '700', fontSize: 15, color: color.text.medium },
  segmentTextActive: { color: color.text.high },
  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, backgroundColor: color.neutral.white,
    borderWidth: 1, borderColor: color.neutral.border, borderRadius: radius.lg - 2,
  },
  settingLabel: { color: color.text.high, fontSize: 16, fontFamily: fontFamily.bold, fontWeight: '700' },
  settingHint: { color: color.text.medium, fontSize: 13, fontFamily: fontFamily.medium, marginTop: 4 },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: color.neutral[300], padding: 2, justifyContent: 'center' },
  toggleOn: { backgroundColor: color.primary[500] },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toggleKnobOn: { transform: [{ translateX: 20 }] },

  formScroll: { padding: 18, paddingBottom: 28 },
  photoSection: { marginTop: 22 },
  photoHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  photoLabel: { fontSize: 14, fontFamily: fontFamily.bold, fontWeight: '700', color: color.text.high, marginBottom: 4 },
  req: { color: color.status.error, fontFamily: fontFamily.bold, fontWeight: '700' },
  counter: { fontFamily: fontFamily.mono, fontSize: 13, color: color.text.medium },
  counterDone: { color: color.status.success },
  photoSub: { fontSize: 13, fontFamily: fontFamily.regular, color: color.text.medium, marginBottom: 12 },
  downloadBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: color.primary[50], borderRadius: radius.sm,
    paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12,
  },
  downloadText: { flex: 1, fontSize: 13, fontFamily: fontFamily.semibold, fontWeight: '600', color: color.primary[700] },

  dropTile: {
    width: '100%', height: 168, borderRadius: radius.lg, borderWidth: 2, borderStyle: 'dashed',
    backgroundColor: color.neutral.white, alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  dropCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: color.primary[50], alignItems: 'center', justifyContent: 'center' },
  dropLabel: { fontFamily: fontFamily.bold, fontWeight: '700', fontSize: 16, color: color.primary[500] },

  mainPhotoWrap: { width: '100%', height: 196, borderRadius: radius.lg, overflow: 'hidden' },
  mainPhoto: { width: '100%', height: '100%' },
  badge: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(12,13,15,0.8)', paddingVertical: 4, paddingHorizontal: 9, borderRadius: 7 },
  badgeText: { color: '#fff', fontSize: 11, fontFamily: fontFamily.bold, fontWeight: '700', letterSpacing: 0.3 },
  retakePill: {
    position: 'absolute', bottom: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(12,13,15,0.78)', paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.sm + 2,
  },
  retakeText: { color: '#fff', fontFamily: fontFamily.bold, fontWeight: '700', fontSize: 14 },

  moreTitle: { fontSize: 13.5, fontFamily: fontFamily.bold, fontWeight: '700', color: color.text.high, marginTop: 18, marginBottom: 3 },
  moreSub: { fontSize: 12.5, fontFamily: fontFamily.regular, color: color.text.medium, marginBottom: 12 },
  thumbStrip: { gap: 10, paddingVertical: 4, paddingRight: 4 },
  thumbCell: { position: 'relative' },
  thumbImg: { width: 92, height: 92, borderRadius: radius.md },
  addThumb: {
    width: 92, height: 92, borderRadius: radius.md, borderWidth: 2, borderStyle: 'dashed', borderColor: color.neutral[300],
    backgroundColor: color.neutral.white, alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  addThumbText: { fontSize: 11.5, fontFamily: fontFamily.bold, fontWeight: '700', color: color.primary[500] },
  deleteX: {
    position: 'absolute', top: -7, right: -7, width: 26, height: 26, borderRadius: 13,
    backgroundColor: color.neutral.ink, borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  footnote: { fontSize: 12.5, fontFamily: fontFamily.regular, color: color.text.low, marginTop: 8 },

  roomStrip: { gap: 10, paddingVertical: 4, paddingRight: 4 },
  roomCell: { position: 'relative' },
  roomImg: { width: 104, height: 128, borderRadius: radius.md },
  coverBadge: { position: 'absolute', top: 7, left: 7, backgroundColor: 'rgba(12,13,15,0.8)', paddingVertical: 3, paddingHorizontal: 7, borderRadius: 6 },
  coverText: { color: '#fff', fontSize: 10, fontFamily: fontFamily.bold, fontWeight: '700', letterSpacing: 0.3 },
  roomAddTile: {
    width: 104, height: 128, borderRadius: radius.md, borderWidth: 2, borderStyle: 'dashed',
    backgroundColor: color.neutral.white, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  dim: { opacity: 0.5 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: color.neutral.sunken, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressLabel: { fontSize: 13, fontFamily: fontFamily.semibold, fontWeight: '600' },
  progressCopy: { fontSize: 13, fontFamily: fontFamily.regular, marginTop: 8 },

  footer: {
    padding: 18, paddingTop: 14, paddingBottom: 14 + BOTTOM_INSET,
    borderTopWidth: 1, borderTopColor: color.neutral.border,
    backgroundColor: color.neutral.canvas,
  },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  errText: { color: color.status.error, fontSize: 13, fontFamily: fontFamily.semibold, fontWeight: '600' },
});
