// Plus Jakarta Sans font loading. The brand treatment is light (300) over bold
// (800), so we register the full weight range used across both surfaces.
//
// `@expo-google-fonts/plus-jakarta-sans` ships the .ttf assets as JS modules —
// no native config beyond expo-font (already in the SDK). The family names here
// must match `theme/tokens.ts → fontFamily`.

import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    'PlusJakarta-Light': PlusJakartaSans_300Light,
    'PlusJakarta-Regular': PlusJakartaSans_400Regular,
    'PlusJakarta-Medium': PlusJakartaSans_500Medium,
    'PlusJakarta-SemiBold': PlusJakartaSans_600SemiBold,
    'PlusJakarta-Bold': PlusJakartaSans_700Bold,
    'PlusJakarta-ExtraBold': PlusJakartaSans_800ExtraBold,
  });
  return loaded;
}
