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
} from './src/services/secureStorage';

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
        } else {
          const defaultBike = {
            id: '106adf90-59a8-4385-abd9-195eb56804f5',
            hardwareId: '106adf90-59a8-4385-abd9-195eb56804f5',
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

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

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
            onRegisterSuccess={(userData) => {
              setUser(userData);
              setAuthTokenState('mock_jwt_token_2026');
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
          onLoginSuccess={(userData) => {
            setUser(userData);
            setAuthTokenState('mock_jwt_token_2026');
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
    backgroundColor: '#131314',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0,
  },
});
