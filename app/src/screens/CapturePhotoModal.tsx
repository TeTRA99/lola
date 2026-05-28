// Full-screen camera preview used by SetupScreen for catalog photo capture.
// Separate from the hidden CameraHost so Describe/Ask still get the silent
// 1x1 capture path; Setup gets a real "frame it before you shoot" preview.

import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, Camera as CameraModule } from 'expo-camera';
import * as Settings from '@/services/Settings';

type Props = {
  onCapture: (result: { uri: string; base64: string; width: number; height: number }) => void;
  onCancel: () => void;
};

export function CapturePhotoModal({ onCapture, onCancel }: Props) {
  const ref = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState(false);
  const [permState, setPermState] = useState<'unknown' | 'granted' | 'denied'>('unknown');

  // Ask for camera permission on mount — needed when the user comes here for
  // the first time after install (or after a fresh reinstall that reset perms).
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
        onCapture({ uri: photo.uri, base64: photo.base64, width: photo.width, height: photo.height });
      }
    } finally {
      setCapturing(false);
    }
  };

  if (permState === 'denied') {
    return (
      <View style={styles.root}>
        <View style={styles.permBox}>
          <Text style={styles.permTitle}>Camera permission needed</Text>
          <Text style={styles.permBody}>
            Enable camera access in Settings → Apps → Lola → Permissions, then come back.
          </Text>
          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>Close</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {permState === 'granted' ? (
        <CameraView ref={ref} style={styles.preview} facing="back" />
      ) : (
        <View style={styles.preview} />
      )}
      <View style={styles.controls}>
        <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={capturing}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.shutter, (capturing || permState !== 'granted') && styles.shutterDim]}
          onPress={handleShutter}
          disabled={capturing || permState !== 'granted'}
        >
          <View style={styles.shutterInner} />
        </Pressable>
        <View style={styles.cancelBtn} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  preview: { flex: 1 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 24,
    backgroundColor: '#000',
  },
  cancelBtn: { width: 80, paddingVertical: 12 },
  cancelBtnText: { color: '#4af', fontSize: 16, textAlign: 'center' },
  shutter: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 5, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff' },
  shutterDim: { opacity: 0.5 },
  permBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  permTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 12 },
  permBody: { color: '#aaa', fontSize: 14, textAlign: 'center', marginBottom: 24 },
});
