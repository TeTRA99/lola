// Manual mock — earcon.ts imports expo-audio (native audio playback), which has
// no runtime under jest. Auto-applied for node_modules manual mocks.
const player = { play: () => {}, pause: () => {}, seekTo: () => {}, remove: () => {}, volume: 1 };
module.exports = {
  createAudioPlayer: () => player,
  setAudioModeAsync: async () => {},
};
