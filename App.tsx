import React, { useState, useEffect } from 'react';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { ClaimScreen } from './src/screens/ClaimScreen';
import { MapDashboardScreen } from './src/screens/MapDashboardScreen';
import { GarageScreen } from './src/screens/GarageScreen';
import { AccountScreen } from './src/screens/AccountScreen';
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
  const [screen, setScreen] = useState<'main' | 'register' | 'help' | 'claim_new'>('main');
  const [activeTab, setActiveTab] = useState<'security' | 'garage' | 'account'>('security');

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
  // Log out clears authentication token but keeps paired bike in memory if available,
  // or fetches user's claimed bikes upon next login.
  const handleLogout = async () => {
    await deleteAuthToken();
    setAuthTokenState(null);
    setUser(null);
  };

  const syncUserBikes = async (token: string) => {
    try {
      const { bikes } = await getMyBikesApi(token);
      if (bikes && bikes.length > 0) {
        await savePairedBike(bikes[0]);
        setPairedBikeState(bikes[0]);
        return;
      }
    } catch {
      // Offline / demo fallback
    }

    const saved = await getPairedBike();
    if (saved) {
      setPairedBikeState(saved);
    } else {
      // Default fallback demo bike so post-login never drops to ClaimScreen for existing user
      const defaultBike = {
        id: '106adf90-59a8-4385-abd9-195eb56804f5',
        hardwareId: '106adf90-59a8-4385-abd9-195eb56804f5',
        nickname: 'My Iron Steed eBike',
        ownerId: 'usr_demo_1',
        geofenceRadiusMeters: 100,
        createdAt: new Date().toISOString(),
      };
      await savePairedBike(defaultBike);
      setPairedBikeState(defaultBike);
    }
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
              const token = await getAuthToken();
              if (token) await syncUserBikes(token);
              setAuthTokenState(token);
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
            const token = await getAuthToken();
            if (token) await syncUserBikes(token);
            setAuthTokenState(token);
          }}
          onNavigateRegister={() => setScreen('register')}
        />
      </View>
    );
  }

  if (screen === 'claim_new') {
    return (
      <View style={styles.container}>
        <ExpoStatusBar style="light" translucent backgroundColor="#131314" />
        <ClaimScreen
          authToken={authToken}
          onClaimSuccess={(bikeData) => {
            handleClaimSuccess(bikeData);
            setScreen('main');
          }}
          onLogout={handleLogout}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ExpoStatusBar style="light" translucent backgroundColor="#131314" />
      {pairedBike ? (
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>
            {activeTab === 'garage' ? (
              <GarageScreen
                bike={pairedBike}
                onUnpair={handleUnpair}
                onNavigateClaimNew={() => setScreen('claim_new')}
              />
            ) : activeTab === 'account' ? (
              <AccountScreen
                onLogout={handleLogout}
                onNavigateHelp={() => setScreen('help')}
              />
            ) : (
              <MapDashboardScreen
                bike={pairedBike}
                onUnpair={handleUnpair}
                onLogout={handleLogout}
                activeTab={activeTab}
                onSelectTab={setActiveTab}
              />
            )}
          </View>
          <View style={styles.bottomNav}>
            <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('security')}>
              <Text style={styles.navIcon}>🏠</Text>
              <Text style={[styles.navLabel, activeTab === 'security' && styles.navLabelActive]}>HOME</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('security')}>
              <Text style={styles.navIcon}>🛡️</Text>
              <Text style={[styles.navLabel, activeTab === 'security' && styles.navLabelActive]}>SECURITY</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('garage')}>
              <Text style={styles.navIcon}>🚲</Text>
              <Text style={[styles.navLabel, activeTab === 'garage' && styles.navLabelActive]}>GARAGE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('account')}>
              <Text style={styles.navIcon}>👤</Text>
              <Text style={[styles.navLabel, activeTab === 'account' && styles.navLabelActive]}>ACCOUNT</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#1C1B1C',
    borderTopWidth: 1,
    borderTopColor: '#363435',
    paddingVertical: 8,
    paddingHorizontal: 16,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  navIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  navLabel: {
    color: '#8E9192',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  navLabelActive: {
    color: '#FFEA00',
  },
});
