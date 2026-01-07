import React, { useState } from 'react';
import { SafeAreaView, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const DEFAULT_URL = 'http://localhost:3000/setup';

export default function App() {
  const [urlInput, setUrlInput] = useState(DEFAULT_URL);
  const [activeUrl, setActiveUrl] = useState('');
  const [error, setError] = useState('');

  const openPortal = () => {
    setError('');
    setActiveUrl(urlInput.trim());
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>WhatsApp Status Manager</Text>
        <Text style={styles.sub}>Enter your backend URL and connect.</Text>
      </View>
      <View style={styles.form}>
        <Text style={styles.label}>Backend URL</Text>
        <TextInput
          style={styles.input}
          value={urlInput}
          onChangeText={setUrlInput}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://192.168.1.10:3000/setup"
          placeholderTextColor="#94a3b8"
        />
        <Pressable style={styles.button} onPress={openPortal}>
          <Text style={styles.buttonText}>Open Setup</Text>
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      {activeUrl ? (
        <View style={styles.webviewWrap}>
          <WebView
            source={{ uri: activeUrl }}
            onError={() => setError('Unable to load the backend. Check the URL and network.')}
          />
        </View>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Waiting for backend connection.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12
  },
  title: {
    color: '#e2e8f0',
    fontSize: 20,
    fontWeight: '600'
  },
  sub: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4
  },
  form: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10
  },
  label: {
    color: '#94a3b8',
    fontSize: 12
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(15,23,42,0.7)',
    color: '#e2e8f0',
    padding: 10,
    borderRadius: 10
  },
  button: {
    backgroundColor: '#4ade80',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center'
  },
  buttonText: {
    color: '#0f172a',
    fontWeight: '600'
  },
  error: {
    color: '#f87171',
    fontSize: 12
  },
  webviewWrap: {
    flex: 1,
    marginTop: 6
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  placeholderText: {
    color: '#94a3b8'
  }
});