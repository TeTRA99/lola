// E6.4 — DebugScreen. Reached from the dev-only 🐞 icon on Home (debug builds).
// Charly-only. English UI (Charly tool). Surfaces local usage_events per AD-6.

import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { getDb } from '@/adapters/storage';
import * as Settings from '@/services/Settings';
import * as VlmAdapter from '@/adapters/visionLLM';
import * as TextAdapter from '@/adapters/textLLM';
import * as OnboardingService from '@/services/OnboardingService';
import { getAskTraces, type AskTrace } from '@/services/AskTrace';
import { getVlmTraces, type VlmTrace } from '@/adapters/vlmTrace';
import { getGuideTraces, type GuideTrace } from '@/adapters/guideTrace';
import { CONFIG } from '@/config';
import { TOP_INSET } from '@/theme/insets';
import {
  groupByDay,
  workingSignal,
  findZeroWeek,
  recentErrors,
  recentEventsWithin,
  type UsageEvent,
} from '@/services/UsageStats';

// All first-run flags, cleared together by "Reset onboarding".
const ONBOARDING_KEYS = [
  Settings.KEYS.welcomeSeen,
  Settings.KEYS.describeHintSeen,
  Settings.KEYS.askHintSeen,
  Settings.KEYS.guideHintSeen,
  Settings.KEYS.heartbeatHintSeen,
  Settings.KEYS.caregiverIntroSeen,
];

export function DebugScreen({ onClose, onOpenGuide }: {
  onClose: () => void;
  onOpenGuide?: (target?: { cocoLabel: string | null; spoken: string; cloudQuery?: string; refImageUri?: string | null }) => void;
}) {
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [traces, setTraces] = useState<AskTrace[]>(() => getAskTraces());
  const [vlmTraces, setVlmTraces] = useState<VlmTrace[]>(() => getVlmTraces());

  // On-device inference A/B controls.
  const [inferMode, setInferMode] = useState<'local' | 'cloud'>('cloud');
  const [vlmSize, setVlmSize] = useState<'450m' | '1.6b'>('450m');
  const [allowFallback, setAllowFallback] = useState(false);
  const [vlmStatus, setVlmStatus] = useState<VlmAdapter.VlmStatus>(() => VlmAdapter.getStatus());
  const [textStatus, setTextStatus] = useState<TextAdapter.TextStatus>(() => TextAdapter.getStatus());

  // Cloud "guide me to it" spike controls.
  const [guideBackend, setGuideBackend] = useState<'device' | 'cloud'>('device');
  const [guideTargeting, setGuideTargeting] = useState<'text' | 'reference'>('text');
  const [guideModel, setGuideModel] = useState<string>(CONFIG.GUIDE_CLOUD_MODEL_DEFAULT);
  const [guideTraces, setGuideTraces] = useState<GuideTrace[]>(() => getGuideTraces());
  const [testQuery, setTestQuery] = useState('una taza');

  useEffect(() => {
    void Settings.getString(Settings.KEYS.inferenceMode, CONFIG.LOCAL_INFERENCE_DEFAULT)
      .then(v => setInferMode(v === 'local' ? 'local' : 'cloud'));
    void Settings.getString(Settings.KEYS.vlmModel, CONFIG.LOCAL_VLM_DEFAULT_SIZE)
      .then(v => setVlmSize(v === '1.6b' ? '1.6b' : '450m'));
    void Settings.getBool(Settings.KEYS.allowCloudFallback, false).then(setAllowFallback);
    void Settings.getString(Settings.KEYS.guideBackend, 'device')
      .then(v => setGuideBackend(v === 'cloud' ? 'cloud' : 'device'));
    void Settings.getString(Settings.KEYS.guideCloudTargeting, 'text')
      .then(v => setGuideTargeting(v === 'reference' ? 'reference' : 'text'));
    void Settings.getString(Settings.KEYS.guideCloudModel, CONFIG.GUIDE_CLOUD_MODEL_DEFAULT)
      .then(v => setGuideModel(v || CONFIG.GUIDE_CLOUD_MODEL_DEFAULT));
    const offV = VlmAdapter.subscribeStatus(setVlmStatus);
    const offT = TextAdapter.subscribeStatus(setTextStatus);
    return () => { offV(); offT(); };
  }, []);

  // "downloading 45%" / "preparing" / "ready ✓" / "idle" / "error".
  const phaseText = (s: { phase: string; progress: number }): string =>
    s.phase === 'downloading' ? `downloading ${Math.round(s.progress * 100)}%`
      : s.phase === 'ready' ? 'ready ✓'
      : s.phase;

  const onSetMode = (m: 'local' | 'cloud') => {
    setInferMode(m);
    void Settings.setString(Settings.KEYS.inferenceMode, m);
  };
  const onSetSize = (s: '450m' | '1.6b') => {
    setVlmSize(s);
    void Settings.setString(Settings.KEYS.vlmModel, s);
    // Drop the currently-loaded VLM so the status stops falsely showing the OLD
    // model as "ready". Back on Home, the idle phase makes ModelPrepBanner kick
    // off the NEW size's download with visible progress (no need to tap Describir).
    void VlmAdapter.unload();
  };
  const onToggleFallback = () => {
    const v = !allowFallback;
    setAllowFallback(v);
    void Settings.setBool(Settings.KEYS.allowCloudFallback, v);
  };
  const onSetGuideBackend = (b: 'device' | 'cloud') => {
    setGuideBackend(b);
    void Settings.setString(Settings.KEYS.guideBackend, b);
  };
  const onSetGuideTargeting = (m: 'text' | 'reference') => {
    setGuideTargeting(m);
    void Settings.setString(Settings.KEYS.guideCloudTargeting, m);
  };
  const onSetGuideModel = (m: string) => {
    setGuideModel(m);
    void Settings.setString(Settings.KEYS.guideCloudModel, m);
  };
  // Launch the spike. In cloud mode, attach the saved object's photo when targeting
  // is 'reference' (matched by the test query) so we can test the saved-photo path.
  const openSpike = async () => {
    if (guideBackend !== 'cloud') { onOpenGuide?.(); return; }
    const q = testQuery.trim() || 'una taza';
    const refImageUri = guideTargeting === 'reference' ? await OnboardingService.referencePhotoFor(q) : null;
    if (guideTargeting === 'reference' && !refImageUri) {
      setExportNote(`No saved object photo matched "${q}" — guiding by name only`);
      setTimeout(() => setExportNote(null), 3500);
    }
    onOpenGuide?.({ cocoLabel: null, spoken: q, cloudQuery: q, refImageUri });
  };
  const onPreload = async () => {
    setExportNote('Preloading on-device models… (first time downloads weights)');
    await Promise.all([VlmAdapter.preload(), TextAdapter.preload()]);
    setExportNote('Preload finished — see status above');
    setTimeout(() => setExportNote(null), 2500);
  };
  const onFreeMemory = async () => {
    await Promise.all([VlmAdapter.unload(), TextAdapter.unload()]);
    setExportNote('Freed on-device model memory');
    setTimeout(() => setExportNote(null), 2000);
  };

  const load = useCallback(async () => {
    try {
      const db = await getDb();
      const rows = await db.getAllAsync<UsageEvent>(
        'SELECT id, occurred_at, action, success, latency_ms, error_kind FROM usage_events ORDER BY occurred_at DESC',
      );
      setEvents(rows);
    } catch {
      setEvents([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const recent14 = recentEventsWithin(events, 14);
  const days = groupByDay(recent14);
  const signal = workingSignal(events);
  const zeroWeek = findZeroWeek(events);
  const errors = recentErrors(events);

  const onExport = async () => {
    await Clipboard.setStringAsync(JSON.stringify(events, null, 2));
    setExportNote(`Exported ${events.length} events to clipboard`);
    setTimeout(() => setExportNote(null), 2500);
  };

  const onResetOnboarding = async () => {
    await Promise.all(ONBOARDING_KEYS.map(k => Settings.setBool(k, false)));
    setExportNote('Onboarding reset — relaunch the app to see the welcome again');
    setTimeout(() => setExportNote(null), 3500);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Debug — usage telemetry</Text>
        <Pressable style={styles.headerBtn} onPress={onClose}>
          <Text style={styles.headerBtnText}>Close</Text>
        </Pressable>
      </View>

      {/* feat/guide-me-to-it spike entry (dev-only). In cloud-backend mode it opens
          the cloud guide with the test query below + a visible camera/box preview;
          otherwise it opens the on-device mock/live spike. */}
      {onOpenGuide ? (
        <Pressable style={styles.guideBtn} onPress={() => void openSpike()}>
          <Text style={styles.guideBtnText}>
            🎯 Open "Guide me to it" spike
            {guideBackend === 'cloud'
              ? ` (cloud · "${testQuery.trim() || 'una taza'}"${guideTargeting === 'reference' ? ' +photo' : ''})`
              : ''}
          </Text>
        </Pressable>
      ) : null}

      {/* On-device inference A/B (cloud vs local VLM) */}
      <View style={[styles.panel, styles.panelNeutral]}>
        <Text style={styles.panelTitle}>On-device inference (A/B)</Text>
        <Text style={styles.activeLine}>
          Active: {inferMode === 'local' ? `On-device · ${vlmStatus.label}` : `Cloud · ${CONFIG.MODEL_ID}`}
        </Text>

        <Text style={styles.segLabel}>Describe / Ask backend</Text>
        <View style={styles.segRow}>
          <Seg active={inferMode === 'cloud'} label="Cloud (Gemini)" onPress={() => onSetMode('cloud')} />
          <Seg active={inferMode === 'local'} label="On-device VLM" onPress={() => onSetMode('local')} />
        </View>

        <Text style={styles.segLabel}>VLM size (A12 default: 450M)</Text>
        <View style={styles.segRow}>
          <Seg active={vlmSize === '450m'} label="450M" onPress={() => onSetSize('450m')} />
          <Seg active={vlmSize === '1.6b'} label="1.6B (heavy)" onPress={() => onSetSize('1.6b')} />
        </View>

        <Pressable style={styles.fallbackRow} onPress={onToggleFallback}>
          <Text style={styles.panelText}>Cloud fallback on local error: {allowFallback ? 'ON' : 'OFF'}</Text>
        </Pressable>

        <Text style={styles.segLabel}>Model status</Text>
        <Text style={styles.panelText}>Vision: {vlmStatus.label} — {phaseText(vlmStatus)}</Text>
        <Text style={styles.panelText}>Voice cmds: {textStatus.label} — {phaseText(textStatus)}</Text>
        <View style={styles.segRow}>
          <Seg active={false} label="Preload models" onPress={() => void onPreload()} />
          <Seg active={false} label="Free memory" onPress={() => void onFreeMemory()} />
        </View>
      </View>

      {/* Cloud "Guide me to it" SPIKE — open-vocab grounding via OpenRouter.
          Independent of the Describe/Ask backend above. */}
      <View style={[styles.panel, styles.panelNeutral]}>
        <Text style={styles.panelTitle}>Cloud guide (spike)</Text>
        <Text style={styles.activeLine}>
          {guideBackend === 'cloud'
            ? `Cloud · ${guideModel.replace(/^.*\//, '')} · ${guideTargeting}`
            : 'On-device YOLO/COCO (default)'}
        </Text>

        <Text style={styles.segLabel}>Guide backend</Text>
        <View style={styles.segRow}>
          <Seg active={guideBackend === 'device'} label="On-device" onPress={() => onSetGuideBackend('device')} />
          <Seg active={guideBackend === 'cloud'} label="Cloud (open-vocab)" onPress={() => onSetGuideBackend('cloud')} />
        </View>

        <Text style={styles.segLabel}>Cloud targeting</Text>
        <View style={styles.segRow}>
          <Seg active={guideTargeting === 'text'} label="Name only" onPress={() => onSetGuideTargeting('text')} />
          <Seg active={guideTargeting === 'reference'} label="Saved photo" onPress={() => onSetGuideTargeting('reference')} />
        </View>

        <Text style={styles.segLabel}>Grounding model</Text>
        {CONFIG.GUIDE_CLOUD_MODELS.map(m => (
          <Pressable key={m} style={[styles.modelRow, guideModel === m && styles.modelRowActive]} onPress={() => onSetGuideModel(m)}>
            <Text style={[styles.modelText, guideModel === m && styles.modelTextActive]}>{m}</Text>
          </Pressable>
        ))}

        <Text style={styles.segLabel}>Spike test query (🎯 button, cloud)</Text>
        <TextInput
          style={styles.queryInput}
          value={testQuery}
          onChangeText={setTestQuery}
          placeholder="una taza"
          placeholderTextColor="#666"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.panelText}>
          Opens the spike with a live camera + box overlay so you can SEE what the model finds.
        </Text>
      </View>

      {/* Cloud grounding traces — raw box + latency per poll (diagnose accuracy). */}
      <View style={[styles.panel, styles.panelNeutral]}>
        <View style={styles.traceHeader}>
          <Text style={styles.panelTitle}>Last cloud grounding polls</Text>
          <View style={{ flexDirection: 'row' }}>
            <Pressable style={styles.headerBtn} onPress={() => setGuideTraces(getGuideTraces())}>
              <Text style={styles.headerBtnText}>Refresh</Text>
            </Pressable>
            <Pressable
              style={styles.headerBtn}
              onPress={() => {
                void Clipboard.setStringAsync(JSON.stringify(getGuideTraces(), null, 2));
                setExportNote('Copied grounding traces to clipboard');
                setTimeout(() => setExportNote(null), 2000);
              }}
            >
              <Text style={styles.headerBtnText}>Copy</Text>
            </Pressable>
          </View>
        </View>
        {guideTraces.length === 0 ? (
          <Text style={styles.panelText}>No cloud guide polls yet. Set backend = Cloud, run "guíame a …", then Refresh.</Text>
        ) : (
          guideTraces.map((tr, i) => (
            <View key={`${tr.at}-${i}`} style={styles.traceRow}>
              <Text style={styles.traceUtterance}>
                "{tr.query}" → {tr.found ? 'FOUND' : 'miss'} {tr.error ? `(${tr.error})` : ''}
              </Text>
              <Text style={styles.traceRoute}>
                {tr.model.replace(/^.*\//, '')} · {tr.latencyMs}ms · conf {tr.confidence.toFixed(2)} · box {tr.box ? `[${tr.box.map(n => Math.round(n)).join(',')}]` : 'null'}
              </Text>
              {!tr.found && tr.raw ? <Text style={styles.traceRaw} numberOfLines={4}>raw: {tr.raw}</Text> : null}
            </View>
          ))
        )}
      </View>

      {/* Ask transcript trace — what STT heard + how it routed (Charly diagnostics) */}
      <View style={[styles.panel, styles.panelNeutral]}>
        <View style={styles.traceHeader}>
          <Text style={styles.panelTitle}>Last Ask transcripts</Text>
          <Pressable style={styles.headerBtn} onPress={() => setTraces(getAskTraces())}>
            <Text style={styles.headerBtnText}>Refresh</Text>
          </Pressable>
        </View>
        {traces.length === 0 ? (
          <Text style={styles.panelText}>No Ask attempts yet. Use Preguntar, then tap Refresh.</Text>
        ) : (
          traces.map((tr, i) => (
            <View key={`${tr.at}-${i}`} style={styles.traceRow}>
              <Text style={styles.traceUtterance}>
                {tr.utterance === null ? '(no transcript)' : `"${tr.utterance}"`}
              </Text>
              <Text style={styles.traceRoute}>→ {tr.route}</Text>
            </View>
          ))
        )}
      </View>

      {/* On-device VLM raw output — tune the prompt against the REAL model text */}
      <View style={[styles.panel, styles.panelNeutral]}>
        <View style={styles.traceHeader}>
          <Text style={styles.panelTitle}>Last on-device descriptions</Text>
          <View style={{ flexDirection: 'row' }}>
            <Pressable style={styles.headerBtn} onPress={() => setVlmTraces(getVlmTraces())}>
              <Text style={styles.headerBtnText}>Refresh</Text>
            </Pressable>
            <Pressable
              style={styles.headerBtn}
              onPress={() => {
                void Clipboard.setStringAsync(JSON.stringify(getVlmTraces(), null, 2));
                setExportNote('Copied VLM output to clipboard');
                setTimeout(() => setExportNote(null), 2000);
              }}
            >
              <Text style={styles.headerBtnText}>Copy</Text>
            </Pressable>
          </View>
        </View>
        {vlmTraces.length === 0 ? (
          <Text style={styles.panelText}>No on-device Describe yet. Set local mode, use Describir, then Refresh.</Text>
        ) : (
          vlmTraces.map((tr, i) => (
            <View key={`${tr.at}-${i}`} style={styles.traceRow}>
              <Text style={styles.traceRoute}>raw ({tr.raw.length} chars):</Text>
              <Text style={styles.traceUtterance}>{tr.raw}</Text>
              <Text style={styles.traceRoute}>spoken: {tr.narration}</Text>
            </View>
          ))
        )}
      </View>

      {/* Working signal */}
      <View style={[styles.panel, signal.kind === 'pass' ? styles.panelPass : signal.kind === 'fail' ? styles.panelFail : styles.panelNeutral]}>
        <Text style={styles.panelTitle}>Working signal (Brief Success Criteria)</Text>
        {signal.kind === 'too_early' ? (
          <Text style={styles.panelText}>{signal.message}</Text>
        ) : signal.kind === 'pass' ? (
          <Text style={styles.panelText}>PASS — week of {signal.weekIso} met threshold (≥3 Describe AND ≥3 Ask)</Text>
        ) : (
          <Text style={styles.panelText}>
            FAIL — week of {signal.weekIso}: {signal.describe} Describe / {signal.ask} Ask (need ≥3 of each)
          </Text>
        )}
      </View>

      {/* Zero-week alert */}
      {zeroWeek ? (
        <View style={[styles.panel, styles.panelDanger]}>
          <Text style={styles.panelTitle}>Failure signal — zero usage detected</Text>
          <Text style={styles.panelText}>Week of {zeroWeek} had no events. Per Brief: retro + pivot-or-rebuild trigger.</Text>
        </View>
      ) : null}

      {/* Per-day counts */}
      <Text style={styles.sectionTitle}>Last 14 days</Text>
      {days.length === 0 ? (
        <Text style={styles.emptyText}>No events yet.</Text>
      ) : (
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellHeader, styles.cellDay]}>Day</Text>
            <Text style={[styles.tableCell, styles.tableCellHeader]}>Describe</Text>
            <Text style={[styles.tableCell, styles.tableCellHeader]}>Ask</Text>
          </View>
          {days.map(d => (
            <View key={d.day} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.cellDay]}>{d.day}</Text>
              <Text style={styles.tableCell}>{d.describe}</Text>
              <Text style={styles.tableCell}>{d.ask}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Errors */}
      <Text style={styles.sectionTitle}>Recent errors (last 20)</Text>
      {errors.length === 0 ? (
        <Text style={styles.emptyText}>No errors logged.</Text>
      ) : (
        <View style={styles.errors}>
          {errors.map(e => (
            <View key={e.id} style={styles.errorRow}>
              <Text style={styles.errorTime}>{new Date(e.occurred_at).toISOString()}</Text>
              <Text style={styles.errorKind}>{e.action}: {e.error_kind ?? 'unknown'}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Export */}
      <Pressable style={styles.exportBtn} onPress={onExport}>
        <Text style={styles.exportBtnText}>Export usage_events JSON to clipboard</Text>
      </Pressable>

      {/* Reset first-run onboarding (welcome + first-use hints + caregiver intro) */}
      <Pressable style={styles.resetBtn} onPress={onResetOnboarding}>
        <Text style={styles.resetBtnText}>Reset onboarding (welcome + hints)</Text>
      </Pressable>
      {exportNote ? <Text style={styles.exportNote}>{exportNote}</Text> : null}

      <Text style={styles.footer}>Total events stored: {events.length}</Text>
    </ScrollView>
  );
}

// Segmented-control button used by the on-device inference panel.
function Seg({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.seg, active && styles.segActive]} onPress={onPress}>
      <Text style={[styles.segText, active && styles.segTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a1a' },
  segLabel: { color: '#888', fontSize: 11, textTransform: 'uppercase', marginTop: 8, marginBottom: 4 },
  segRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  seg: { flex: 1, paddingVertical: 10, borderRadius: 6, backgroundColor: '#333', alignItems: 'center' },
  segActive: { backgroundColor: '#1A73E8' },
  segText: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  segTextActive: { color: '#fff' },
  fallbackRow: { paddingVertical: 8 },
  modelRow: { paddingVertical: 9, paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#333', marginBottom: 6 },
  modelRowActive: { backgroundColor: '#1A73E8' },
  modelText: { color: '#aaa', fontSize: 12, fontFamily: 'monospace' },
  modelTextActive: { color: '#fff', fontWeight: '700' },
  queryInput: {
    backgroundColor: '#222', color: '#fff', fontSize: 14, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 9, marginBottom: 6,
    borderWidth: 1, borderColor: '#444',
  },
  activeLine: { color: '#7fd', fontSize: 13, fontWeight: '700', marginTop: 2, marginBottom: 4 },
  content: { padding: 16, paddingTop: TOP_INSET + 16, paddingBottom: 64 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#333', marginBottom: 16,
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '600' },
  headerBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  headerBtnText: { color: '#4af', fontSize: 16 },
  panel: { padding: 12, borderRadius: 8, marginBottom: 12 },
  panelNeutral: { backgroundColor: '#333' },
  panelPass: { backgroundColor: '#1e4a1e' },
  panelFail: { backgroundColor: '#4a3a1e' },
  panelDanger: { backgroundColor: '#5a1e1e' },
  panelTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  panelText: { color: '#fff', fontSize: 13 },
  traceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  traceRow: { paddingVertical: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#333' },
  traceUtterance: { color: '#fff', fontSize: 13 },
  traceRoute: { color: '#8c8', fontSize: 12, fontFamily: 'monospace' },
  traceRaw: { color: '#fbbf24', fontSize: 11, fontFamily: 'monospace', marginTop: 2 },
  sectionTitle: { color: '#aaa', fontSize: 13, marginTop: 16, marginBottom: 6, textTransform: 'uppercase' },
  emptyText: { color: '#666', fontSize: 13, fontStyle: 'italic' },
  table: { backgroundColor: '#222', borderRadius: 6, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#333' },
  tableCell: { flex: 1, padding: 8, color: '#ddd', fontSize: 13, textAlign: 'center' },
  tableCellHeader: { fontWeight: '600', color: '#888', fontSize: 12 },
  cellDay: { flex: 2, textAlign: 'left' },
  errors: { backgroundColor: '#222', borderRadius: 6, padding: 8 },
  errorRow: { paddingVertical: 4 },
  errorTime: { color: '#888', fontSize: 11 },
  errorKind: { color: '#fcc', fontSize: 13 },
  exportBtn: {
    marginTop: 24, padding: 14, backgroundColor: '#4af', borderRadius: 8, alignItems: 'center',
  },
  exportBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  resetBtn: {
    marginTop: 12, padding: 14, backgroundColor: '#5a3a1e', borderRadius: 8, alignItems: 'center',
  },
  resetBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  guideBtn: {
    marginBottom: 16, padding: 14, backgroundColor: '#1A73E8', borderRadius: 8, alignItems: 'center',
  },
  guideBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  exportNote: { color: '#4af', fontSize: 13, marginTop: 8, textAlign: 'center' },
  footer: { color: '#666', fontSize: 12, marginTop: 24, textAlign: 'center' },
});
