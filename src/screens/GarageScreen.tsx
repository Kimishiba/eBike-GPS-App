import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
} from 'react-native';

interface GarageScreenProps {
  bike: any;
  onUnpair: () => void;
  onNavigateClaimNew: () => void;
}

export const GarageScreen: React.FC<GarageScreenProps> = ({ bike, onUnpair, onNavigateClaimNew }) => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#131314" />
      <View style={styles.header}>
        <Text style={styles.brandTitle}>IRON STEED GARAGE</Text>
        <Text style={styles.headerSubtitle}>REGISTERED FLEET & HARDWARE SPECIFICATIONS</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Active Bike Card */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <View style={styles.activeTag}>
              <Text style={styles.activeTagText}>PRIMARY EBIKE</Text>
            </View>
            <Text style={styles.bikeNickname}>{bike?.nickname || 'Iron Steed Tracker'}</Text>
          </View>

          <View style={styles.specRow}>
            <Text style={styles.specLabel}>HARDWARE UUID</Text>
            <Text style={styles.specVal}>{bike?.hardwareId || bike?.id || 'Unknown'}</Text>
          </View>

          <View style={styles.specRow}>
            <Text style={styles.specLabel}>SAFE GEOFENCE RADIUS</Text>
            <Text style={styles.specVal}>{bike?.geofenceRadiusMeters || 100} meters</Text>
          </View>

          <View style={styles.specRow}>
            <Text style={styles.specLabel}>FIRMWARE REVISION</Text>
            <Text style={styles.specVal}>v2.4.0 (SIM7000G LTE-M)</Text>
          </View>

          <View style={styles.specRow}>
            <Text style={styles.specLabel}>REGISTRATION DATE</Text>
            <Text style={styles.specVal}>
              {bike?.createdAt ? new Date(bike.createdAt).toLocaleDateString() : 'Active'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.unpairBtn}
            onPress={() => {
              Alert.alert(
                'Unpair Bike',
                `Are you sure you want to unpair "${bike?.nickname || 'this bike'}" from your account?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Unpair', style: 'destructive', onPress: onUnpair },
                ]
              );
            }}
          >
            <Text style={styles.unpairBtnText}>UNPAIR HARDWARE BOARD</Text>
          </TouchableOpacity>
        </View>

        {/* Claim Another Board Card */}
        <View style={styles.addCard}>
          <Text style={styles.addTitle}>PAIR ADDITIONAL EBIKE BOARD</Text>
          <Text style={styles.addSubtitle}>
            Scan factory QR sticker code to add a secondary tracker to your fleet.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={onNavigateClaimNew}>
            <Text style={styles.primaryBtnText}>+ PAIR NEW HARDWARE BOARD</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131314',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#363435',
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFEA00',
    letterSpacing: 1.5,
  },
  headerSubtitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8E9192',
    letterSpacing: 1,
    marginTop: 4,
  },
  scrollContent: {
    padding: 16,
  },
  sectionCard: {
    backgroundColor: '#1C1B1C',
    borderWidth: 1,
    borderColor: '#363435',
    borderRadius: 6,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    marginBottom: 16,
  },
  activeTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 234, 0, 0.15)',
    borderWidth: 1,
    borderColor: '#FFEA00',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  activeTagText: {
    color: '#FFEA00',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  bikeNickname: {
    fontSize: 18,
    fontWeight: '800',
    color: '#E2E2E2',
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2B292A',
  },
  specLabel: {
    color: '#8E9192',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  specVal: {
    color: '#E2E2E2',
    fontSize: 12,
    fontWeight: '600',
  },
  unpairBtn: {
    backgroundColor: '#2B292A',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 20,
  },
  unpairBtnText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  addCard: {
    backgroundColor: '#1C1B1C',
    borderWidth: 1,
    borderColor: '#363435',
    borderRadius: 6,
    padding: 16,
  },
  addTitle: {
    color: '#FFEA00',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  addSubtitle: {
    color: '#8E9192',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: '#FFEA00',
    paddingVertical: 14,
    borderRadius: 4,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#131314',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});
