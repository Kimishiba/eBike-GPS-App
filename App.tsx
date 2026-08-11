import React, { useState, useEffect } from 'react';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { StyleSheet, View, Platform, StatusBar } from 'react-native';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { ClaimScreen } from './src/screens/ClaimScreen';
import { MapDashboardScreen } from './src/screens/MapDashboardScreen';
import { SplashScreen } from './src/screens/SplashScreen';
import { HelpScreen } from './src/screens/HelpScreen';
import {
  getAuthToken,
  getPairedBike,
  setPairedBike as savePairedBike,
  deletePairedBike,
  deleteAuthToken,
} from './src/services/secureStorage';
import { getMyBikesApi } from './src/services/api';

export default function App() {
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [authToken, setAuthTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [pairedBike, setPairedBikeState] = useState<any | null>(null);
  const [screen, setScreen] = useState<'main' | 'register' | 'help'>('main');

  useEffect(() => {
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

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

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
    return <SplashScreen onFinish={() => {}} />;
  }

  if (screen === 'help') {
    return (
      <View style={styles.container}>
        <ExpoStatusBar style="light" translucent backgroundColor="#131314" />
        <HelpScreen onBack={() => setScreen('main')} />
      </View>
    );
  }

  if (!authToken) {
    if (screen === 'register') {
      return (
        <View style={styles.container}>
          <ExpoStatusBar style="light" translucent backgroundColor="#131314" />
          <RegisterScreen
            onRegisterSuccess={async (userData) => {
              setUser(userData);
              setAuthTokenState(await getAuthToken());
              setScreen('main');
            }}
            onNavigateLogin={() => setScreen('main')}
          />
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <ExpoStatusBar style="light" translucent backgroundColor="#131314" />
        <LoginScreen
          onLoginSuccess={async (userData) => {
            setUser(userData);
            setAuthTokenState(await getAuthToken());
          }}
          onNavigateRegister={() => setScreen('register')}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ExpoStatusBar style="light" translucent backgroundColor="#131314" />
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
    backgroundColor: '#131314',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0,
  },
});
