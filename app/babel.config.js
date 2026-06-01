module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module-resolver', { alias: { '@': './src' } }],
      // NOTE: do NOT add 'react-native-worklets/plugin' here. babel-preset-expo
      // (SDK 52+) auto-injects it — correctly placed last — whenever the package
      // is installed. Adding it manually ran the worklets transform twice, which
      // caused a runtime "[Worklets] Failed to create a worklet" when VisionCamera
      // loaded (the guide screen). VisionCamera frame processors still work.
    ],
  };
};
