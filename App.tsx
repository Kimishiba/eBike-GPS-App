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
} from './src/services/secureStorage';

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
        } else {
          // If board is already flashed/provisioned, set default bike profile
          const defaultBike = {
            id: 'bike_01',
            hardwareId: '71d0dad7-1afa-4328-9931-c7b07ee28238',
            nickname: 'My LilyGO eBike',
            ownerId: 'usr_demo_1',
            geofenceRadiusMeters: 100,
            createdAt: new Date().toISOString(),
          };
          await savePairedBike(defaultBike);
          setPairedBikeState(defaultBike);
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
        <MapDashboardScreen bike={pairedBike} onUnpair={handleUnpair} />
      ) : (
        <ClaimScreen onClaimSuccess={handleClaimSuccess} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingTop: Platform.OS === 'android' ? 20 : 0,
  },
  loadingCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
