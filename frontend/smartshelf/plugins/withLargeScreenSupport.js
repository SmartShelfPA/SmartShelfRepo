const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const ML_KIT_SCANNER_ACTIVITY =
  'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity';

/**
 * Strip forced screenOrientation / ensure resizeableActivity so Play Console
 * large-screen (Android 16+) guidance is satisfied. Portrait can still be
 * preferred on phones at runtime via expo-screen-orientation.
 *
 * Also overrides the ML Kit barcode delegate activity, which ships with
 * android:screenOrientation="portrait" in its library manifest.
 */
function withLargeScreenSupport(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const root = androidManifest.manifest;

    // Ensure tools: namespace for tools:remove / tools:replace
    if (!root.$) root.$ = {};
    if (!root.$['xmlns:tools']) {
      root.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);

    const activities = application.activity ?? [];
    for (const activity of activities) {
      if (!activity.$) continue;
      delete activity.$['android:screenOrientation'];
      activity.$['android:resizeableActivity'] = 'true';
    }

    const aliases = application['activity-alias'] ?? [];
    for (const alias of aliases) {
      if (!alias.$) continue;
      delete alias.$['android:screenOrientation'];
    }

    // Override ML Kit library activity (merged after prebuild from AAR).
    let mlKit = activities.find((a) => a.$?.['android:name'] === ML_KIT_SCANNER_ACTIVITY);
    if (!mlKit) {
      mlKit = {
        $: {
          'android:name': ML_KIT_SCANNER_ACTIVITY,
        },
      };
      if (!application.activity) application.activity = [];
      application.activity.push(mlKit);
    }
    delete mlKit.$['android:screenOrientation'];
    mlKit.$['tools:remove'] = 'android:screenOrientation';
    mlKit.$['android:resizeableActivity'] = 'true';
    mlKit.$['tools:replace'] = 'android:resizeableActivity';

    return config;
  });
}

module.exports = withLargeScreenSupport;
