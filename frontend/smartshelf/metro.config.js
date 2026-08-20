const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const pdfShim = path.resolve(__dirname, 'src/shims/react-native-pdf.web.js');

// Hermes transform profiles emit `import.meta`, but Expo's web HTML loads the
// bundle as a classic script (no type="module"), which crashes Chrome.
if (config.transformer) {
  config.transformer.unstable_transformProfile = 'default';
}

// Zustand (and some ESM packages) ship import.meta via package exports; prefer CJS.
config.resolver.unstable_enablePackageExports = false;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-pdf') {
    return {
      filePath: pdfShim,
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
