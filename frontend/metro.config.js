// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');
const { FileStore } = require('metro-cache');

const config = getDefaultConfig(__dirname);

// Use a stable on-disk store (shared across web/android)
const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, '.metro-cache');
config.cacheStores = [
  new FileStore({ root: path.join(root, 'cache') }),
];

// Remove console.log/warn/error in production builds
// This keeps logs during development but strips them from release APK/AAB
if (process.env.NODE_ENV === 'production' || !process.env.EXPO_DEV) {
  config.transformer = {
    ...config.transformer,
    minifierConfig: {
      ...config.transformer?.minifierConfig,
      compress: {
        ...config.transformer?.minifierConfig?.compress,
        drop_console: true,
      },
    },
  };
}

// Reduce the number of workers to decrease resource usage
config.maxWorkers = 2;

module.exports = config;
