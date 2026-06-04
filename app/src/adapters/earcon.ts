// Audible mic open/close earcons — iOS only.
//
// Android's system SpeechRecognizer plays its own start/stop beep, so the Ask
// hint's promised "tono" was already audible there. iOS's SFSpeechRecognizer
// plays nothing, so on iOS the cue was silent — the user had no idea when the
// mic actually opened. We play our own short rising chime on mic-open ("hablá
// ahora") and a falling one on mic-close ("listo, te escuché").
//
// Guarded to iOS so we don't double-beep over Android's system tone. The native
// audio module (expo-audio) is compiled in via its config plugin.

import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

let openPlayer: AudioPlayer | null = null;
let closePlayer: AudioPlayer | null = null;
let initTried = false;

function ensurePlayers(): void {
  if (initTried) return;
  initTried = true;
  try {
    // playsInSilentMode: like Lola's voice, the earcon must be heard even with
    // the ringer switch off — an assistive cue shouldn't vanish on mute.
    // interruptionMode 'mixWithOthers' is CRITICAL: without it, expo-audio seizes
    // the shared AVAudioSession to play the chime and then DEACTIVATES it when the
    // ~210ms chime ends. That (a) collided with the speech recognizer claiming
    // playAndRecord → the mic input never opened (STT timed out with no audiostart),
    // and (b) tore the session down mid-TTS → Lola's voice faded to silence.
    // 'mixWithOthers' makes the earcon a good citizen that mixes into whatever
    // session STT/TTS already own, instead of fighting them.
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' });
    openPlayer = createAudioPlayer(require('../../assets/audio/mic-open.wav'));
    closePlayer = createAudioPlayer(require('../../assets/audio/mic-close.wav'));
  } catch { /* best effort — never break the Ask flow on an audio hiccup */ }
}

function replay(p: AudioPlayer | null): void {
  if (!p) return;
  try { p.seekTo(0); p.play(); } catch { /* best effort */ }
}

/** Rising chime — the mic just opened, the user can talk now. iOS-only. */
export function micOpenEarcon(): void {
  if (Platform.OS !== 'ios') return;
  ensurePlayers();
  replay(openPlayer);
}

/** Falling chime — the mic closed / Lola stopped listening. iOS-only. */
export function micCloseEarcon(): void {
  if (Platform.OS !== 'ios') return;
  ensurePlayers();
  replay(closePlayer);
}
