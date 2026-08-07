import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { ClaimScreen } from './src/screens/ClaimScreen';
import { MapDashboardScreen } from './src/screens/MapDashboardScreen';

export default function App() {
  const [pairedBike, setPairedBike] = useState<any | null>(null);

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
});
