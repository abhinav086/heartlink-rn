const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    sourceExts: ['js', 'jsx', 'ts', 'tsx', 'json'],
    assetExts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'],
  },
  transformer: {
    babelTransformerPath: require.resolve('metro-react-native-babel-transformer'),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);