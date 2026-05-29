// Full-screen camera capture used by Setup (handoff §7). Live phase shows the
// viewfinder with a framing guide + top hint and a centered shutter; after a
// shot we freeze into a review phase ("Retake" / "Use photo") so the caregiver
// confirms before the embedding pipeline runs. Only "Use photo" calls
// onCapture. Separate from the hidden CameraHost so Describe/Ask keep the
// silent 1×1 capture path.

import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraView, Camera as CameraModule } from 'expo-camera';
import * as Settings from '@/services/Settings';
import { Icon } from '@/components/Icon';
import { useSetupStrings } from '@/i18n';
import { color, radius, fontFamily } from '@/theme/tokens';
import { TOP_INSET, BOTTOM_INSET } from '@/theme/insets';

type Shot = { uri: string; base64: string; width: number; height: number };

type Props = {
  hint: string;
  onCapture: (result: Shot) => void;
  onCancel: () => void;
};

export function CapturePhotoModal({ hint, onCapture, onCancel }: Props) {
  const t = useSetupStrings();
  const ref = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState(false);
  const [permState, setPermState] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [review, setReview] = useState<Shot | null>(null);

  useEffect(() => {
    void (async () => {
      const p = await CameraModule.requestCameraPermissionsAsync();
      setPermState(p.granted ? 'granted' : 'denied');
    })();
  }, []);

  const handleShutter = async () => {
    if (capturing || !ref.current) return;
    setCapturing(true);
    try {
      type TakePictureResult = { uri: string; base64?: string; width: number; height: number };
      type CameraViewWithCapture = CameraView & {
        takePictureAsync(opts: { base64: boolean; quality: number; skipProcessing: boolean; shutterSound?: boolean }): Promise<TakePictureResult | undefined>;
      };
      const photo = await (ref.current as CameraViewWithCapture).takePictureAsync({
        base64: true,
        quality: 0.85,
        skipProcessing: false,
        shutterSound: !Settings.getBoolSync(Settings.KEYS.quietCapture, false),
      });
      if (photo && photo.base64) {
        setReview({ uri: photo.uri, base64: photo.base64, width: photo.width, height: photo.height });
      }
    } finally {
      setCapturing(false);
    }
  };

  if (permState === 'denied') {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.permBox}>
          <Text style={styles.permTitle}>{t.capPermTitle}</Text>
          <Text style={styles.permBody}>{t.capPermBody}</Text>
          <Pressable style={styles.linkBtn} onPress={onCancel}>
            <Text style={styles.linkText}>{t.capClose}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.viewfinder}>
        {review ? (
          <Image source={{ uri: review.uri }} style={StyleSheet.absoluteFill} />
        ) : permState === 'granted' ? (
          <CameraView ref={ref} style={StyleSheet.absoluteFill} facing="back" />
        ) : (
          <View style={StyleSheet.absoluteFill} />
        )}

        {!review && <View style={styles.guide} pointerEvents="none" />}
        <Text style={[styles.hint, { top: TOP_INSET + 6 }]}>{review ? t.capLooksGood : hint}</Text>
      </View>

      <View style={styles.controls}>
        {review ? (
          <View style={styles.reviewRow}>
            <Pressable style={styles.retakeBtn} onPress={() => setReview(null)}>
              <Icon name="retake" size={18} color="#fff" />
              <Text style={styles.retakeText}>{t.capRetake}</Text>
            </Pressable>
            <Pressable style={styles.useBtn} onPress={() => onCapture(review)}>
              <Icon name="check" size={20} color="#fff" />
              <Text style={styles.useText}>{t.capUse}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.liveRow}>
            <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={capturing}>
              <Text style={styles.linkText}>{t.capCancel}</Text>
            </Pressable>
            <Pressable
              style={[styles.shutter, (capturing || permState !== 'granted') && styles.shutterDim]}
              onPress={handleShutter}
              disabled={capturing || permState !== 'granted'}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
            />
            <View style={styles.cancelBtn} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  viewfinder: { flex: 1, position: 'relative', overflow: 'hidden' },
  guide: {
    position: 'absolute', top: 28, left: 28, right: 28, bottom: 28,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 18,
  },
  hint: {
    position: 'absolute', left: 0, right: 0, textAlign: 'center',
    color: '#fff', fontSize: 17, fontFamily: fontFamily.semibold, fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6,
  },

  controls: { backgroundColor: '#000', paddingHorizontal: 24, paddingTop: 22, paddingBottom: 18 + BOTTOM_INSET },
  liveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cancelBtn: { width: 80, paddingVertical: 12 },
  linkBtn: { paddingVertical: 12 },
  linkText: { color: color.dad.askAccent, fontSize: 17, fontFamily: fontFamily.semibold, fontWeight: '600' },
  shutter: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: '#fff', borderWidth: 5, borderColor: 'rgba(255,255,255,0.35)',
  },
  shutterDim: { opacity: 0.5 },

  reviewRow: { flexDirection: 'row', gap: 12 },
  retakeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: radius.md, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
  },
  retakeText: { color: '#fff', fontSize: 16, fontFamily: fontFamily.bold, fontWeight: '700' },
  useBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16, borderRadius: radius.md, backgroundColor: color.primary[500],
  },
  useText: { color: '#fff', fontSize: 18, fontFamily: fontFamily.bold, fontWeight: '700' },

  permBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  permTitle: { color: '#fff', fontSize: 18, fontFamily: fontFamily.bold, fontWeight: '700', marginBottom: 12 },
  permBody: { color: '#aaa', fontSize: 14, fontFamily: fontFamily.regular, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
});
