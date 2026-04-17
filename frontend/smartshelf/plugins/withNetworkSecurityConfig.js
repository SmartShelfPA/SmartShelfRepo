const { getMainApplicationOrThrow } = require('expo/config-plugins').AndroidConfig.Manifest;
const { getResourceFolderAsync } = require('expo/config-plugins').AndroidConfig.Paths;
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const { mkdir, copyFile } = require('fs/promises');
const { join } = require('path');

/**
 * Expo config plugin: adds Android network_security_config.xml
 * allowing cleartext (HTTP) ONLY for my-backend.com
 */
function withNetworkSecurityConfig(config, { networkSecurityConfig } = {}) {
  const configPath = networkSecurityConfig || './assets/configs/network_security_config.xml';

  // Copy network_security_config.xml to android/app/src/main/res/xml
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const { projectRoot } = config.modRequest;
      const resourcePath = await getResourceFolderAsync(projectRoot);

      await mkdir(join(resourcePath, 'xml'), { recursive: true });
      await copyFile(
        join(projectRoot, configPath),
        join(resourcePath, 'xml', 'network_security_config.xml')
      );

      return config;
    },
  ]);

  // Add networkSecurityConfig to AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const mainApplication = getMainApplicationOrThrow(config.modResults);
    mainApplication.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return config;
  });

  return config;
}

module.exports = withNetworkSecurityConfig;
