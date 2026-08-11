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

import { BLE_AUTO_DISARM_ENABLED, useBleProximityDisarm } from '../hooks/useBleProximityDisarm';
import { getDeviceSecret, getPairedBleDeviceId, setPairedBleDeviceId, getAuthToken } from '../services/secureStorage';
import { fetchLatestTelemetryApi, sendIntervalCommandApi } from '../services/api';
import { ConnectionState, connectionBadgeLabel, deriveConnectionState } from '../services/connectionState';

interface MapDashboardScreenProps {
  bike: any;
  onUnpair: () => void;
  onLogout: () => void;
}

const TELEMETRY_POLL_INTERVAL_MS = 5000;

// Wide, non-committal camera framing shown only until a real GPS fix arrives -
// intentionally not a plausible-looking coordinate.
const NO_FIX_REGION = {
  latitude: 0,
  longitude: 0,
  latitudeDelta: 60,
  longitudeDelta: 60,
};

const CONNECTION_BADGE_COLORS: Record<ConnectionState, { bg: string; fg: string }> = {
  LIVE: { bg: 'rgba(16, 185, 129, 0.15)', fg: '#10B981' },
  STALE: { bg: 'rgba(234, 179, 8, 0.15)', fg: '#EAB308' },
  DISCONNECTED: { bg: 'rgba(239, 68, 68, 0.15)', fg: '#EF4444' },
  CONNECTING: { bg: 'rgba(148, 163, 184, 0.15)', fg: '#94A3B8' },
};

export const MapDashboardScreen: React.FC<MapDashboardScreenProps> = ({ bike, onUnpair, onLogout }) => {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [batteryVolts, setBatteryVolts] = useState<number | null>(null);
  const [batteryPercent, setBatteryPercent] = useState<number | null>(null);
  const [satsUsed, setSatsUsed] = useState<number | null>(null);
  const [alarmArmed, setAlarmArmed] = useState<boolean>(true);
  const [motorCutEnabled, setMotorCutEnabled] = useState<boolean>(false);
  const [reportingIntervalSecs, setReportingIntervalSecs] = useState<number>(60);
  const [commandStatus, setCommandStatus] = useState<string>('Waiting for Next Board Broadcast...');

  const [lastFrameAt, setLastFrameAt] = useState<number | null>(null);
  const [lastErrorAt, setLastErrorAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState<number>(Date.now());
  const connectionState = deriveConnectionState(lastFrameAt, lastErrorAt, nowTick);

  const handleSelectInterval = async (val: number) => {
    if (!bike?.id) {
      setCommandStatus('⚠️ No paired board id - cannot send command');
      return;
    }

    setReportingIntervalSecs(val);
    setCommandStatus('Transmitting to Fly.io...');

    try {
      const token = await getAuthToken();
      const res = await sendIntervalCommandApi(bike.id, val, token);
      const cmdId = res?.command_id ? ` (#${res.command_id})` : '';
      setCommandStatus(`✅ Sent to Fly.io Broker${cmdId}`);
    } catch (err: any) {
      setCommandStatus(`⚠️ Fly.io Transmit Error: ${err.message || 'Check connection'}`);
    }
  };

  // Poll the REST telemetry snapshot on an interval. React Native's fetch
  // doesn't expose a streaming ReadableStream body, so an SSE-style reader
  // never receives a byte here - polling is the transport RN actually supports.
  useEffect(() => {
    if (!bike?.id) return;
    let active = true;
    let inFlight = false;

    const pollOnce = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const token = await getAuthToken();
        const frame = await fetchLatestTelemetryApi(bike.id, token);
        if (!active) return;

        const lat = frame.latitude ?? frame.lat;
        const lon = frame.longitude ?? frame.lon;
        if (lat !== undefined && lon !== undefined && (Number(lat) !== 0 || Number(lon) !== 0)) {
          setLocation({ latitude: Number(lat), longitude: Number(lon) });
        }

        if (frame.speed !== undefined && frame.speed !== null) setSpeed(Number(frame.speed));

        const batV = frame.battery_voltage ?? (frame as any).batteryVoltage ?? (frame as any).voltage;
        if (batV !== undefined && batV !== null) setBatteryVolts(Number(batV));

        const batP = frame.battery_percent ?? (frame as any).batteryPercent ?? (frame as any).percent;
        if (batP !== undefined && batP !== null) setBatteryPercent(Number(batP));

        const sats = frame.sats_used ?? (frame as any).satsUsed ?? (frame as any).sats;
        if (sats !== undefined && sats !== null) setSatsUsed(Number(sats));

        setLastFrameAt(Date.now());
      } catch (err) {
        if (active) setLastErrorAt(Date.now());
      } finally {
        inFlight = false;
      }
    };

    pollOnce();
    const pollHandle = setInterval(pollOnce, TELEMETRY_POLL_INTERVAL_MS);
    const tickHandle = setInterval(() => setNowTick(Date.now()), TELEMETRY_POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(pollHandle);
      clearInterval(tickHandle);
    };
  }, [bike?.id]);

  // BLE Proximity Auto-Disarm Hook
  const [deviceSecret, setDeviceSecret] = useState<string | null>(null);
  const [pairedBleDeviceId, setPairedBleDeviceIdState] = useState<string | null>(null);

  useEffect(() => {
    if (!bike?.id) return;
    getDeviceSecret(bike.id).then(setDeviceSecret);
    getPairedBleDeviceId(bike.id).then(setPairedBleDeviceIdState);
  }, [bike?.id]);

  const { scanning, currentRssi, disarmStatus } = useBleProximityDisarm(
    deviceSecret,
    alarmArmed,
    pairedBleDeviceId,
    (newDeviceId) => {
      setPairedBleDeviceIdState(newDeviceId);
      if (bike?.id) setPairedBleDeviceId(bike.id, newDeviceId);
    }
  );

  // Perform 2-Factor Motor Kill Confirmation
  const handleToggleMotorCut = async () => {
    if (speed === null) {
      Alert.alert(
        'Speed Unknown',
        'Cannot verify current speed - motor kill is disabled until live telemetry is received.'
      );
      return;
    }

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
              // No backend motor-cut command channel exists yet - this only
              // changes the app's local switch state, so say so plainly
              // rather than claiming the board received anything.
              setCommandStatus('⚠️ Applied locally only - no board command channel implemented yet');
            },
          },
        ]
      );
    } else {
      setMotorCutEnabled(false);
      setCommandStatus('Applied locally only - no board command channel implemented yet');
    }
  };

  const handleToggleArmStatus = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (hasHardware) {
      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: `Authenticate to ${alarmArmed ? 'DISARM' : 'ARM'} eBike security system`,
        fallbackLabel: 'Use PIN',
      });

      if (!authResult.success) {
        Alert.alert('Authentication Failed', 'Biometric confirmation required to change alarm status.');
        return;
      }
    }

    setAlarmArmed(!alarmArmed);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.bikeNickname}>{bike?.nickname || 'My eBike'}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.onlineBadge, { backgroundColor: CONNECTION_BADGE_COLORS[connectionState].bg }]}>
              <Text style={[styles.onlineBadgeText, { color: CONNECTION_BADGE_COLORS[connectionState].fg }]}>
                {connectionBadgeLabel(connectionState)}
              </Text>
            </View>
            <Text style={styles.firmwareBadge}>v1.0.0</Text>
          </View>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <TouchableOpacity
            style={[styles.armBtn, alarmArmed ? styles.armBtnActive : styles.armBtnDisarmed]}
            onPress={handleToggleArmStatus}
          >
            <Text style={styles.armBtnText}>{alarmArmed ? '🔒 ARMED' : '🔓 DISARMED'}</Text>
          </TouchableOpacity>
          {!BLE_AUTO_DISARM_ENABLED && (
            <Text style={styles.armBtnCaption}>Local state only - auto-disarm paused</Text>
          )}
        </View>
      </View>

      {/* Interactive Map View */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          region={
            location
              ? { latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 }
              : NO_FIX_REGION
          }
        >
          {location && (
            <>
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
            </>
          )}
        </MapView>
        {!location && (
          <View style={styles.awaitingFixOverlay}>
            <Text style={styles.awaitingFixText}>📡 Awaiting first GPS fix…</Text>
          </View>
        )}
      </View>

      {/* Swipeable Bottom Sheet Status Panel */}
      <View style={styles.bottomSheet}>
        <ScrollView contentContainerStyle={styles.sheetContent}>
          {/* Telemetry Metrics Row */}
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>CURRENT SPEED</Text>
              <Text style={styles.metricValue}>{speed !== null ? speed.toFixed(1) : '--'}</Text>
              <Text style={styles.metricUnit}>km/h</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>BATTERY LEVEL</Text>
              <Text style={styles.metricValue}>
                {batteryPercent !== null ? `${batteryPercent}%` : '--'}
              </Text>
              <Text style={styles.metricUnit}>
                {batteryVolts !== null ? `${batteryVolts.toFixed(2)}V Cell` : 'Syncing...'}
              </Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>GPS SATELLITES</Text>
              <Text style={styles.metricValue}>
                {satsUsed !== null ? satsUsed : '--'}
              </Text>
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
                  onPress={() => handleSelectInterval(opt.val)}
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
          <View style={[styles.controlCard, !BLE_AUTO_DISARM_ENABLED && styles.controlCardPaused]}>
            <Text style={styles.cardTitle}>📶 BLE Proximity Auto-Disarm</Text>
            <Text style={styles.cardSubtitle}>
              RSSI Gate: &gt;= -75 dBm (&lt; 2-3m proximity)
            </Text>
            <View style={{ marginTop: 8 }}>
              <Text style={{ color: BLE_AUTO_DISARM_ENABLED ? '#38BDF8' : '#94A3B8', fontSize: 12, fontWeight: '600' }}>
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
                  {speed === null
                    ? 'Awaiting live telemetry - speed unknown'
                    : speed >= 5.0
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

          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutBtnText}>Log Out</Text>
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
  armBtnCaption: {
    color: '#64748B',
    fontSize: 9,
    marginTop: 4,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  awaitingFixOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  awaitingFixText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
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
  controlCardPaused: {
    opacity: 0.5,
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
  logoutBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
});
