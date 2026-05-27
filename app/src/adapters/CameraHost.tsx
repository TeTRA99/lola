// Mounts a hidden CameraView (1×1 offscreen) and registers its ref with the
// camera adapter. Place this once near the app root; services call
// captureSnapshot() without needing the React tree.

import { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { _registerCameraRef } from './camera';

export function CameraHost() {
  const ref = useRef<CameraView>(null);
  const [permission] = useCameraPermissions();

  useEffect(() => {
    _registerCameraRef(ref.current);
    return () => _registerCameraRef(null);
  }, [permission]);

  if (!permission?.granted) {
    // Don't mount CameraView until permission is granted — avoids the "no camera"
    // black surface in the offscreen render. Permission request happens lazily
    // in captureSnapshot(), which will then trigger a re-render via the hook.
    return null;
  }

  return (
    <View style={styles.hidden} pointerEvents="none">
      <CameraView ref={ref} facing="back" />
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
