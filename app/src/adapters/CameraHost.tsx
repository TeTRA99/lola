// Mounts a hidden CameraView (1×1 offscreen) and registers its ref with the
// camera adapter. Place this once near the app root; services call
// captureSnapshot() without needing the React tree.

import { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { CameraView } from 'expo-camera';
import { _registerCameraRef, _setCameraReady } from './camera';

export function CameraHost() {
  const ref = useRef<CameraView>(null);

  useEffect(() => {
    _registerCameraRef(ref.current);
    return () => { _registerCameraRef(null); _setCameraReady(false); };
  }, []);

  // Always mount the hidden CameraView. The 1×1 offscreen surface causes no
  // visual issue pre-permission, and removing the permission gate eliminates
  // a race where captureSnapshot fires before useCameraPermissions has settled.
  // onCameraReady signals the stream is live so captureSnapshot doesn't fire
  // before the camera can actually take a picture (hangs on MIUI/Redmi otherwise).
  return (
    <View style={styles.hidden} pointerEvents="none">
      <CameraView
        ref={ref}
        facing="back"
        onCameraReady={() => _setCameraReady(true)}
        onMountError={(e) => { console.log('[camera] mount error:', e); _setCameraReady(false); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
