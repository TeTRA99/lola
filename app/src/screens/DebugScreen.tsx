// E6.4 — DebugScreen. Reached from the dev-only 🐞 icon on Home (debug builds).
// Charly-only. English UI (Charly tool). Surfaces local usage_events per AD-6.

import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { getDb } from '@/adapters/storage';
import * as Settings from '@/services/Settings';
import * as VlmAdapter from '@/adapters/visionLLM';
import * as TextAdapter from '@/adapters/textLLM';
import { getAskTraces, type AskTrace } from '@/services/AskTrace';
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

export function DebugScreen({ onClose, onOpenGuide }: { onClose: () => void; onOpenGuide?: () => void }) {
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [traces, setTraces] = useState<AskTrace[]>(() => getAskTraces());

  // On-device inference A/B controls.
  const [inferMode, setInferMode] = useState<'local' | 'cloud'>('cloud');
  const [vlmSize, setVlmSize] = useState<'450m' | '1.6b'>('450m');
  const [allowFallback, setAllowFallback] = useState(false);
  const [vlmStatus, setVlmStatus] = useState<VlmAdapter.VlmStatus>(() => VlmAdapter.getStatus());
  const [textStatus, setTextStatus] = useState<TextAdapter.TextStatus>(() => TextAdapter.getStatus());

  useEffect(() => {
    void Settings.getString(Settings.KEYS.inferenceMode, CONFIG.LOCAL_INFERENCE_DEFAULT)
      .then(v => setInferMode(v === 'local' ? 'local' : 'cloud'));
    void Settings.getString(Settings.KEYS.vlmModel, CONFIG.LOCAL_VLM_DEFAULT_SIZE)
      .then(v => setVlmSize(v === '1.6b' ? '1.6b' : '450m'));
    void Settings.getBool(Settings.KEYS.allowCloudFallback, false).then(setAllowFallback);
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
  };
  const onToggleFallback = () => {
    const v = !allowFallback;
    setAllowFallback(v);
    void Settings.setBool(Settings.KEYS.allowCloudFallback, v);
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

      {/* feat/guide-me-to-it spike entry (dev-only). */}
      {onOpenGuide ? (
        <Pressable style={styles.guideBtn} onPress={onOpenGuide}>
          <Text style={styles.guideBtnText}>🎯 Open "Guide me to it" spike</Text>
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
