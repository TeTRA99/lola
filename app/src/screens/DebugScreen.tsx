// E6.4 — DebugScreen. Hidden behind 10-second LaunchSplash hold. Charly-only.
// English UI (Charly tool). Surfaces local usage_events telemetry per AD-6.

import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { getDb } from '@/adapters/storage';
import {
  groupByDay,
  workingSignal,
  findZeroWeek,
  recentErrors,
  recentEventsWithin,
  type UsageEvent,
} from '@/services/UsageStats';

export function DebugScreen({ onClose }: { onClose: () => void }) {
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [exportNote, setExportNote] = useState<string | null>(null);

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

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Debug — usage telemetry</Text>
        <Pressable style={styles.headerBtn} onPress={onClose}>
          <Text style={styles.headerBtnText}>Close</Text>
        </Pressable>
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
      {exportNote ? <Text style={styles.exportNote}>{exportNote}</Text> : null}

      <Text style={styles.footer}>Total events stored: {events.length}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a1a' },
  content: { padding: 16, paddingBottom: 64 },
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
  exportNote: { color: '#4af', fontSize: 13, marginTop: 8, textAlign: 'center' },
  footer: { color: '#666', fontSize: 12, marginTop: 24, textAlign: 'center' },
});
