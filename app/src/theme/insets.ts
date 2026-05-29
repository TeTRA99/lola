// Manual safe-area insets. Android 15+ forces edge-to-edge, so app content
// draws under the status bar and the system navigation bar. Until the nav bar
// is hidden app-wide (needs expo-navigation-bar + a rebuild) and/or
// react-native-safe-area-context is bundled, we pad bottom containers by a
// fixed amount sized for a 3-button nav bar.
//
// TODO: once react-native-safe-area-context ships in the build, replace
// BOTTOM_INSET with useSafeAreaInsets().bottom for gesture-nav / notch accuracy.

import { Platform, StatusBar } from 'react-native';

export const TOP_INSET = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 47;

// 3-button Android nav bar ≈ 48dp; iOS home indicator ≈ 34dp.
export const BOTTOM_INSET = Platform.OS === 'android' ? 48 : 34;
