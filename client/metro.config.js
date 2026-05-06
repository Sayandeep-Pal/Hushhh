// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Fix for react-native-qrcode-svg / qrcode browser issues
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  './renderer/canvas': require.resolve('react-native-svg'),
};

module.exports = config;
