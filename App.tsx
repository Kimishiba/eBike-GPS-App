import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { LoginScreen } from './src/screens/LoginScreen';
import { ClaimScreen } from './src/screens/ClaimScreen';
import { MapDashboardScreen } from './src/screens/MapDashboardScreen';
import { getAuthToken } from './src/services/secureStorage';

export default function App() {
  const [loading, setLoading] = useState<boolean>(true);
  const [authToken, setAuthTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [pairedBike, setPairedBike] = useState<any | null>(null);

  useEffect(() => {
    // Check saved session auth token on app launch
    getAuthToken()
      .then((token) => {
        if (token) {
          setAuthTokenState(token);
          setUser({ id: 'saved_user', email: 'user@ebike.app' });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingCenter]}>
        <ActivityIndicator size="large" color="#38BDF8" />
      </View>
    );
  }

  // Step 1: Unauthenticated ➔ LoginScreen
  if (!authToken) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <LoginScreen
          onLoginSuccess={(token, userData) => {
            setAuthTokenState(token);
            setUser(userData);
          }}
        />
      </View>
    );
  }

  // Step 2: Authenticated ➔ MapDashboardScreen (if paired) OR ClaimScreen (if unclaimed)
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {pairedBike ? (
        <MapDashboardScreen bike={pairedBike} onUnpair={() => setPairedBike(null)} />
      ) : (
        <ClaimScreen onClaimSuccess={(bikeData) => setPairedBike(bikeData)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
