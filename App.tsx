import React, { useState, useEffect } from 'react';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator, Platform, StatusBar } from 'react-native';
import { LoginScreen } from './src/screens/LoginScreen';
import { ClaimScreen } from './src/screens/ClaimScreen';
import { MapDashboardScreen } from './src/screens/MapDashboardScreen';
import {
  getAuthToken,
  getPairedBike,
  setPairedBike as savePairedBike,
  deletePairedBike,
  deleteAuthToken,
} from './src/services/secureStorage';
import { getMyBikesApi } from './src/services/api';

export default function App() {
  const [loading, setLoading] = useState<boolean>(true);
  const [authToken, setAuthTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [pairedBike, setPairedBikeState] = useState<any | null>(null);

  useEffect(() => {
    // Check saved session auth token & paired bike on launch
    Promise.all([getAuthToken(), getPairedBike()])
      .then(async ([token, savedBike]) => {
        if (token) {
          setAuthTokenState(token);
          setUser({ id: 'saved_user', email: 'user@ebike.app' });
        }

        if (savedBike) {
          setPairedBikeState(savedBike);
        } else if (token) {
          // The local paired-bike flag only ever gets set once, when the
          // post-claim success Alert is dismissed (ClaimScreen.tsx) - if that
          // never happened (app closed/reinstalled first) even though the
          // claim already succeeded server-side, this recovers it from
          // server truth instead of sending an already-claimed user back
          // through ClaimScreen, where their (now burned) claim code can
          // only fail.
          try {
            const { bikes } = await getMyBikesApi(token);
            if (bikes && bikes.length > 0) {
              await savePairedBike(bikes[0]);
              setPairedBikeState(bikes[0]);
            }
          } catch {
            // Best-effort recovery only - fall through to ClaimScreen.
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleClaimSuccess = async (bikeData: any) => {
    await savePairedBike(bikeData);
    setPairedBikeState(bikeData);
  };

  const handleUnpair = async () => {
    await deletePairedBike();
    setPairedBikeState(null);
  };

  // Clears the stored session so a stale/foreign-signed token (e.g. from
  // switching which backend the app points at) can't keep the app stuck
  // retrying requests the server will only ever reject.
  const handleLogout = async () => {
    await deleteAuthToken();
    await deletePairedBike();
    setAuthTokenState(null);
    setUser(null);
    setPairedBikeState(null);
  };

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
        <ExpoStatusBar style="light" translucent backgroundColor="#0F172A" />
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
      <ExpoStatusBar style="light" translucent backgroundColor="#0F172A" />
      {pairedBike ? (
        <MapDashboardScreen bike={pairedBike} onUnpair={handleUnpair} onLogout={handleLogout} />
      ) : (
        <ClaimScreen authToken={authToken} onClaimSuccess={handleClaimSuccess} onLogout={handleLogout} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0,
  },
  loadingCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
