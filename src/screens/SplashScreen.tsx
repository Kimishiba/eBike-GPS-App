import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, StatusBar } from 'react-native';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 1800);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#131314" />
      <View style={styles.emblemCircle}>
        <Text style={styles.emblemIcon}>🛡️</Text>
      </View>
      <Text style={styles.brandTitle}>IRON STEED</Text>
      <Text style={styles.brandSubtitle}>SENTINEL KINETIC SECURITY</Text>

      <ActivityIndicator color="#FFEA00" style={{ marginTop: 32 }} />
      <Text style={styles.loadingText}>CONNECTING TO TELEMETRY UPLINK...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131314',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emblemCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#0E0E0F',
    borderWidth: 2,
    borderColor: '#FFEA00',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emblemIcon: {
    fontSize: 44,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFEA00',
    letterSpacing: 2,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E9192',
    letterSpacing: 1.5,
    marginTop: 6,
  },
  loadingText: {
    color: '#8E9192',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 16,
  },
});
