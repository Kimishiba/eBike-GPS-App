import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import * as LocalAuthentication from 'expo-local-authentication';

import { useBleProximityDisarm } from '../hooks/useBleProximityDisarm';

interface MapDashboardScreenProps {
  bike: any;
  onUnpair: () => void;
}

export const MapDashboardScreen: React.FC<MapDashboardScreenProps> = ({ bike, onUnpair }) => {
  // Telemetry Mock/SSE State
  const [location, setLocation] = useState({
    latitude: 45.4642,
    longitude: 9.19,
  });
  const [speed, setSpeed] = useState<number>(18.4);
  const [batteryVolts, setBatteryVolts] = useState<number>(3.95);
  const [batteryPercent, setBatteryPercent] = useState<number>(84);
  const [satsUsed, setSatsUsed] = useState<number>(9);
  const [alarmArmed, setAlarmArmed] = useState<boolean>(true);
  const [motorCutEnabled, setMotorCutEnabled] = useState<boolean>(false);
  const [reportingIntervalSecs, setReportingIntervalSecs] = useState<number>(60);
  const [commandStatus, setCommandStatus] = useState<string>('Applied');

  // BLE Proximity Auto-Disarm Hook
  const { scanning, currentRssi, disarmStatus } = useBleProximityDisarm(
    bike?.deviceSecret || 'q0YjJ1RU...',
    alarmArmed
  );

  // Perform 2-Factor Motor Kill Confirmation
  const handleToggleMotorCut = async () => {
    if (speed >= 5.0) {
      Alert.alert(
        '⚠️ Safety Interlock Active',
        `Cannot disable motor while eBike is moving (${speed.toFixed(1)} km/h). Speed must be below 5 km/h.`
      );
      return;
    }

    if (!motorCutEnabled) {
      // Prompt for Biometric Verification (FaceID / Fingerprint)
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (hasHardware) {
        const authResult = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to confirm Remote Motor Shutdown',
          fallbackLabel: 'Use PIN',
        });

        if (!authResult.success) {
          Alert.alert('Authentication Failed', 'Biometric confirmation required for motor kill.');
          return;
        }
      }

      Alert.alert(
        'Confirm Remote Motor Kill',
        'Are you sure you want to disable the eBike motor relay?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable Motor 🚫',
            style: 'destructive',
            onPress: () => {
              setMotorCutEnabled(true);
              setCommandStatus('Delivered to Board');
            },
          },
        ]
      );
    } else {
      setMotorCutEnabled(false);
      setCommandStatus('Applied');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.bikeNickname}>{bike?.nickname || 'My eBike'}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.onlineBadge}>
              <Text style={styles.onlineBadgeText}>🟢 Wi-Fi (mDNS Connected)</Text>
            </View>
            <Text style={styles.firmwareBadge}>v1.0.0</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.armBtn, alarmArmed ? styles.armBtnActive : styles.armBtnDisarmed]}
          onPress={() => setAlarmArmed(!alarmArmed)}
        >
          <Text style={styles.armBtnText}>{alarmArmed ? '🔒 ARMED' : '🔓 DISARMED'}</Text>
        </TouchableOpacity>
      </View>

      {/* Interactive Map View */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
        >
          {/* Safe Zone Geofence Overlay Ring */}
          <Circle
            center={location}
            radius={bike?.geofenceRadiusMeters || 100}
            fillColor="rgba(56, 189, 248, 0.15)"
            strokeColor="#38BDF8"
            strokeWidth={2}
          />

          {/* Live Animated Bike Marker */}
          <Marker coordinate={location} title={bike?.nickname || 'eBike'}>
            <View style={styles.markerContainer}>
              <Text style={styles.markerEmoji}>🚲</Text>
            </View>
          </Marker>
        </MapView>
      </View>

      {/* Swipeable Bottom Sheet Status Panel */}
      <View style={styles.bottomSheet}>
        <ScrollView contentContainerStyle={styles.sheetContent}>
          {/* Telemetry Metrics Row */}
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>CURRENT SPEED</Text>
              <Text style={styles.metricValue}>{speed.toFixed(1)}</Text>
              <Text style={styles.metricUnit}>km/h</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>BATTERY LEVEL</Text>
              <Text style={styles.metricValue}>{batteryPercent}%</Text>
              <Text style={styles.metricUnit}>{batteryVolts.toFixed(2)}V Cell</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>GPS SATELLITES</Text>
              <Text style={styles.metricValue}>{satsUsed}</Text>
              <Text style={styles.metricUnit}>Fixed 3D</Text>
            </View>
          </View>

          {/* Reporting Interval Selector */}
          <View style={styles.controlCard}>
            <Text style={styles.cardTitle}>Telemetry Reporting Interval</Text>
            <Text style={styles.cardSubtitle}>
              Current: {reportingIntervalSecs < 60 ? `${reportingIntervalSecs}s` : `${reportingIntervalSecs / 60}m`}
            </Text>
            <View style={styles.intervalRow}>
              {[
                { label: '30s Stolen', val: 30 },
                { label: '1m Normal', val: 60 },
                { label: '15m Eco', val: 900 },
                { label: '6h Sleep', val: 21600 },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.val}
                  style={[
                    styles.intervalChip,
                    reportingIntervalSecs === opt.val && styles.intervalChipActive,
                  ]}
                  onPress={() => {
                    setReportingIntervalSecs(opt.val);
                    setCommandStatus('Queued in #23 Table');
                  }}
                >
                  <Text
                    style={[
                      styles.intervalChipText,
                      reportingIntervalSecs === opt.val && styles.intervalChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.commandStatusText}>Command Receipt: {commandStatus}</Text>
          </View>

          {/* BLE Proximity Auto-Disarm Status Card */}
          <View style={styles.controlCard}>
            <Text style={styles.cardTitle}>📶 BLE Proximity Auto-Disarm</Text>
            <Text style={styles.cardSubtitle}>
              RSSI Gate: &gt;= -75 dBm (&lt; 2-3m proximity)
            </Text>
            <View style={{ marginTop: 8 }}>
              <Text style={{ color: '#38BDF8', fontSize: 12, fontWeight: '600' }}>
                Status: {disarmStatus}
              </Text>
              {currentRssi !== null && (
                <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 2 }}>
                  Signal Strength: {currentRssi} dBm
                </Text>
              )}
            </View>
          </View>

          {/* Remote Motor Kill Safety Card */}
          <View style={[styles.controlCard, motorCutEnabled && styles.controlCardDanger]}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Remote Motor Kill Switch</Text>
                <Text style={styles.cardSubtitle}>
                  {speed >= 5.0
                    ? `⚠️ Speed Interlock (${speed.toFixed(1)} km/h >= 5.0 km/h)`
                    : 'Requires Biometrics & Speed < 5 km/h'}
                </Text>
              </View>
              <Switch
                value={motorCutEnabled}
                onValueChange={handleToggleMotorCut}
                trackColor={{ false: '#334155', true: '#EF4444' }}
                thumbColor={motorCutEnabled ? '#FFF' : '#94A3B8'}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.unpairBtn} onPress={onUnpair}>
            <Text style={styles.unpairBtnText}>Unpair Board from Account</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  bikeNickname: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  onlineBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
  },
  onlineBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '600',
  },
  firmwareBadge: {
    color: '#94A3B8',
    fontSize: 11,
  },
  armBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  armBtnActive: {
    backgroundColor: '#0284C7',
  },
  armBtnDisarmed: {
    backgroundColor: '#334155',
  },
  armBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    backgroundColor: '#1E293B',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#38BDF8',
  },
  markerEmoji: {
    fontSize: 20,
  },
  bottomSheet: {
    height: 320,
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  sheetContent: {
    padding: 20,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  metricLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 4,
  },
  metricValue: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
  },
  metricUnit: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  controlCard: {
    backgroundColor: '#0F172A',
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  controlCardDanger: {
    borderColor: '#EF4444',
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  intervalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  intervalChip: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    marginHorizontal: 2,
    borderRadius: 8,
    alignItems: 'center',
  },
  intervalChipActive: {
    backgroundColor: '#0284C7',
  },
  intervalChipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  intervalChipTextActive: {
    color: '#FFF',
  },
  commandStatusText: {
    color: '#38BDF8',
    fontSize: 11,
    marginTop: 10,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unpairBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  unpairBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
});
