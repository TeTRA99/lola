module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module-resolver', { alias: { '@': './src' } }],
      // VisionCamera v5 frame processors run on a worklet runtime; this plugin
      // must stay LAST in the list.
      'react-native-worklets/plugin',
    ],
  };
};
