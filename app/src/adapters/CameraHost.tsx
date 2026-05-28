// Mounts a hidden CameraView (1×1 offscreen) and registers its ref with the
// camera adapter. Place this once near the app root; services call
// captureSnapshot() without needing the React tree.

import { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { CameraView } from 'expo-camera';
import { _registerCameraRef } from './camera';

export function CameraHost() {
  const ref = useRef<CameraView>(null);

  useEffect(() => {
    _registerCameraRef(ref.current);
    return () => _registerCameraRef(null);
  }, []);

  // Always mount the hidden CameraView. The 1×1 offscreen surface causes no
  // visual issue pre-permission, and removing the permission gate eliminates
  // a race where captureSnapshot fires before useCameraPermissions has settled.
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
