import React, { useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

const DEFAULT_AUTH_URL = 'https://my-backend.com/auth';

export type InAppAuthWebViewParams = {
  url?: string;
};

type Props = NativeStackScreenProps<RootStackParamList, 'InAppAuthWebView'>;

export default function InAppAuthWebView({ route }: Props) {
  const { url } = route.params ?? {};
  const [loading, setLoading] = useState(true);

  const source =
    url && url.trim().length > 0
      ? { uri: url.trim() }
      : { uri: DEFAULT_AUTH_URL };

  return (
    <View style={styles.container}>
      <WebView
        source={source}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
      />
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#00FF41" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
