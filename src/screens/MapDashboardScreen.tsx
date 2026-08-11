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
  StatusBar,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import * as LocalAuthentication from 'expo-local-authentication';

import { BLE_AUTO_DISARM_ENABLED, useBleProximityDisarm } from '../hooks/useBleProximityDisarm';
import { getDeviceSecret, getPairedBleDeviceId, setPairedBleDeviceId, getAuthToken } from '../services/secureStorage';
import { fetchLatestTelemetryApi, sendIntervalCommandApi } from '../services/api';
import { ConnectionState, connectionBadgeLabel, deriveConnectionState } from '../services/connectionState';

// Custom Dark Map Styling matching Stitch Onyx theme (#131314)
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#131314' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#131314' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8E9192' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#FFEA00' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#8E9192' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2B292A' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#363435' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#C4C7C5' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0E0E0F' }] },
];

interface MapDashboardScreenProps {
  bike: any;
  onUnpair: () => void;
  onLogout: () => void;
  activeTab: 'security' | 'garage' | 'account';
  onSelectTab: (tab: 'security' | 'garage' | 'account') => void;
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

function formatLastUpdate(lastFrameAt: number | null, now: number): string {
  if (lastFrameAt === null) return 'Last update: never';
  const seconds = Math.floor((now - lastFrameAt) / 1000);
  if (seconds < 5) return 'Last update: just now';
  if (seconds < 60) return `Last update: ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Last update: ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `Last update: ${hours}h ago`;
}

export const MapDashboardScreen: React.FC<MapDashboardScreenProps> = ({
  bike,
  onUnpair,
  onLogout,
  activeTab,
  onSelectTab,
}) => {
  // Telemetry State
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [batteryVolts, setBatteryVolts] = useState<number | null>(null);
  const [batteryPercent, setBatteryPercent] = useState<number | null>(null);
  const [satsUsed, setSatsUsed] = useState<number | null>(null);
  const [alarmArmed, setAlarmArmed] = useState<boolean>(true);
  const [motorCutEnabled, setMotorCutEnabled] = useState<boolean>(false);
  const [reportingIntervalSecs, setReportingIntervalSecs] = useState<number>(60);
  const [commandStatus, setCommandStatus] = useState<string>('Uplink Active');

  // Logs for Activity Log accordion
  const [activityLogs, setActivityLogs] = useState<Array<{ ts: string; msg: string; highlight?: boolean }>>([
    { ts: '10:42:01', msg: 'Uplink Established' },
    { ts: '10:41:15', msg: 'BT Handshake OK' },
    { ts: '10:40:00', msg: 'Ignition Detected' },
    { ts: '10:35:12', msg: 'Shock Warning', highlight: true },
    { ts: '10:00:00', msg: 'System Armed' },
  ]);

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
    setCommandStatus('Transmitting command...');

    try {
      const token = await getAuthToken();
      const res = await sendIntervalCommandApi(bike.id, val, token);
      const cmdId = res?.command_id ? ` (#${res.command_id})` : '';
      setCommandStatus(`✅ Sent to Broker${cmdId}`);
      setActivityLogs((prev) => [{ ts: new Date().toTimeString().slice(0, 8), msg: `Interval -> ${val}s` }, ...prev]);
    } catch (err: any) {
      setCommandStatus(`⚠️ Transmit Error: ${err.message || 'Failed'}`);
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

  // BLE Proximity Hook
  const [deviceSecret, setDeviceSecret] = useState<string | null>(null);
  const [pairedBleDeviceId, setPairedBleDeviceIdState] = useState<string | null>(null);

  useEffect(() => {
    if (!bike?.id) return;
    getDeviceSecret(bike.id).then(setDeviceSecret);
    getPairedBleDeviceId(bike.id).then(setPairedBleDeviceIdState);
  }, [bike?.id]);

  const { currentRssi, disarmStatus } = useBleProximityDisarm(
    deviceSecret,
    alarmArmed,
    pairedBleDeviceId,
    (newDeviceId) => {
      setPairedBleDeviceIdState(newDeviceId);
      if (bike?.id) setPairedBleDeviceId(bike.id, newDeviceId);
    }
  );

  const handleToggleMotorCut = async () => {
    if (speed === null) {
      Alert.alert(
        'Speed Unknown',
        'Cannot verify current speed - motor kill is disabled until live telemetry is received.'
      );
      return;
    }

    if (speed >= 5.0) {
      Alert.alert('⚠️ Safety Interlock', `Speed (${speed.toFixed(1)} km/h) must be under 5 km/h.`);
      return;
    }

    if (!motorCutEnabled) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (hasHardware) {
        const authResult = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to confirm Remote Motor Kill',
        });
        if (!authResult.success) {
          Alert.alert('Authentication Failed', 'Biometric confirmation required.');
          return;
        }
      }

      Alert.alert(
        'Confirm Motor Shutdown',
        'Disable motor relay remotely?',
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
              setActivityLogs((prev) => [{ ts: new Date().toTimeString().slice(0, 8), msg: 'Motor Kill Applied (Local)', highlight: true }, ...prev]);
            },
          },
        ]
      );
    } else {
      setMotorCutEnabled(false);
      setCommandStatus('⚠️ Applied locally only - no board command channel implemented yet');
    }
  };

  const handleToggleArmStatus = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (hasHardware) {
      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: `Authenticate to ${alarmArmed ? 'DISARM' : 'ARM'} security system`,
      });
      if (!authResult.success) {
        Alert.alert('Authentication Failed', 'Biometric confirmation required.');
        return;
      }
    }
    const nextState = !alarmArmed;
    setAlarmArmed(nextState);
    setActivityLogs((prev) => [{ ts: new Date().toTimeString().slice(0, 8), msg: nextState ? 'System ARMED' : 'System DISARMED' }, ...prev]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#131314" />

      {/* Top Header Bar */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.brandRow}>
            <Text style={styles.brandIcon}>🛡️</Text>
            <Text style={styles.brandTitle}>{bike?.nickname || 'IRON STEED'}</Text>
          </View>
          <View style={styles.badgeRow}>
            <View style={[styles.onlineBadge, { backgroundColor: CONNECTION_BADGE_COLORS[connectionState].bg }]}>
              <Text style={[styles.onlineBadgeText, { color: CONNECTION_BADGE_COLORS[connectionState].fg }]}>
                {connectionBadgeLabel(connectionState)}
              </Text>
            </View>
          </View>
          <Text style={styles.lastUpdateText}>{formatLastUpdate(lastFrameAt, nowTick)}</Text>
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

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Shields Row */}
        <View style={styles.statusShieldsRow}>
          <View style={styles.statusShieldCard}>
            <Text style={styles.shieldIcon}>📶</Text>
            <Text style={styles.shieldText}>BT LINK</Text>
          </View>
          <View style={styles.statusShieldCard}>
            <Text style={styles.shieldIcon}>🛰️</Text>
            <Text style={styles.shieldText}>UPLINK</Text>
          </View>
        </View>

        {/* Tactical Map Container */}
        <View style={styles.mapFrame}>
          <View style={styles.mapOverlayHeader}>
            <View style={styles.liveTrackingTag}>
              <View style={styles.pulseDot} />
              <Text style={styles.liveTrackingText}>
                {connectionState === 'LIVE' ? 'LIVE TRACKING ACTIVE' : connectionBadgeLabel(connectionState)}
              </Text>
            </View>
          </View>

          <MapView
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            customMapStyle={DARK_MAP_STYLE}
            region={
              location
                ? { latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 }
                : NO_FIX_REGION
            }
          >
            {location && (
              <>
                <Circle
                  center={location}
                  radius={bike?.geofenceRadiusMeters || 100}
                  fillColor="rgba(255, 234, 0, 0.12)"
                  strokeColor="#FFEA00"
                  strokeWidth={1.5}
                />
                <Marker coordinate={location} title={bike?.nickname || 'eBike'} zIndex={999}>
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

          <View style={styles.mapOverlayFooter}>
            <View>
              <Text style={styles.locationLabel}>CURRENT LOC</Text>
              <Text style={styles.locationCoords}>
                {location ? `${location.latitude.toFixed(4)}° N, ${location.longitude.toFixed(4)}° E` : '-- N, -- E'}
              </Text>
            </View>
            <Text style={styles.accuracyTag}>{location ? '3.2m ACC' : '--'}</Text>
          </View>
        </View>

        {/* Telemetry Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>CURRENT SPEED</Text>
            <Text style={styles.metricValue}>{speed !== null ? speed.toFixed(1) : '--'}</Text>
            <Text style={styles.metricUnit}>KM/H</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>BATTERY LEVEL</Text>
            <Text style={styles.metricValue}>
              {batteryPercent !== null ? `${batteryPercent}%` : '--'}
            </Text>
            <Text style={styles.metricUnit}>
              {batteryVolts !== null ? `${batteryVolts.toFixed(2)}V` : 'SYNCING'}
            </Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>SATELLITES</Text>
            <Text style={styles.metricValue}>{satsUsed !== null ? satsUsed : '--'}</Text>
            <Text style={styles.metricUnit}>FIXED 3D</Text>
          </View>
        </View>

        {/* Telemetry Frequency Control Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>UPDATE FREQ</Text>
            <Text style={styles.statusText}>{commandStatus}</Text>
          </View>

          <View style={styles.chipRow}>
            {[
              { label: '30S STOLEN', val: 30 },
              { label: '1M NORMAL', val: 60 },
              { label: '15M ECO', val: 900 },
              { label: '6H SLEEP', val: 21600 },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.val}
                style={[
                  styles.freqChip,
                  reportingIntervalSecs === opt.val && styles.freqChipActive,
                ]}
                onPress={() => handleSelectInterval(opt.val)}
              >
                <Text
                  style={[
                    styles.freqChipText,
                    reportingIntervalSecs === opt.val && styles.freqChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* BLE Proximity Auto-Disarm Status */}
        <View style={[styles.sectionCard, !BLE_AUTO_DISARM_ENABLED && styles.cardDisabled]}>
          <Text style={styles.sectionTitle}>BLE PROXIMITY AUTO-DISARM</Text>
          <Text style={styles.cardSubtext}>
            RSSI Gate: &gt;= -75 dBm (&lt; 2-3m) | Status: {disarmStatus}
          </Text>
          {currentRssi !== null && (
            <Text style={styles.cardSubtext}>Signal: {currentRssi} dBm</Text>
          )}
        </View>

        {/* Remote Motor Kill Safety Card */}
        <View style={[styles.sectionCard, motorCutEnabled && styles.cardDanger]}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>REMOTE MOTOR KILL SWITCH</Text>
              <Text style={styles.cardSubtext}>
                {speed === null
                  ? 'Awaiting live telemetry - speed unknown'
                  : speed >= 5.0
                  ? `⚠️ Speed Interlock (${speed.toFixed(1)} km/h)`
                  : 'Requires Biometrics'}
              </Text>
            </View>
            <Switch
              value={motorCutEnabled}
              onValueChange={handleToggleMotorCut}
              trackColor={{ false: '#363435', true: '#EF4444' }}
              thumbColor={motorCutEnabled ? '#FFEA00' : '#8E9192'}
            />
          </View>
        </View>

        {/* Activity Logs Accordion */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>ACTIVITY LOGS</Text>
          <View style={styles.logsContainer}>
            {activityLogs.map((log, idx) => (
              <View key={idx} style={styles.logRow}>
                <Text style={styles.logTime}>{log.ts}</Text>
                <Text style={[styles.logMsg, log.highlight && styles.logHighlight]}>
                  {log.msg}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity style={styles.actionBtnDanger} onPress={onUnpair}>
          <Text style={styles.actionBtnTextDanger}>UNPAIR BIKE</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutBtnText}>LOG OUT</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131314',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#131314',
    borderBottomWidth: 1,
    borderBottomColor: '#363435',
  },
  headerLeft: {
    flex: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFEA00',
    letterSpacing: 1.5,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  onlineBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  onlineBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  lastUpdateText: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 4,
  },
  armBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
  },
  armBtnActive: {
    backgroundColor: 'rgba(255, 234, 0, 0.15)',
    borderColor: '#FFEA00',
  },
  armBtnDisarmed: {
    backgroundColor: '#2B292A',
    borderColor: '#363435',
  },
  armBtnText: {
    color: '#FFEA00',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1,
  },
  armBtnCaption: {
    color: '#64748B',
    fontSize: 9,
    marginTop: 4,
    maxWidth: 120,
    textAlign: 'right',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 90,
  },
  statusShieldsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statusShieldCard: {
    flex: 1,
    backgroundColor: '#1C1B1C',
    borderWidth: 1,
    borderColor: '#363435',
    borderRadius: 4,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  shieldText: {
    color: '#8E9192',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  mapFrame: {
    height: 280,
    backgroundColor: '#1C1B1C',
    borderWidth: 1,
    borderColor: '#363435',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  mapOverlayHeader: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  liveTrackingTag: {
    backgroundColor: 'rgba(19, 19, 20, 0.85)',
    borderWidth: 1,
    borderColor: '#FFEA00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFEA00',
    marginRight: 6,
  },
  liveTrackingText: {
    color: '#FFEA00',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
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
    backgroundColor: 'rgba(19, 19, 20, 0.75)',
  },
  awaitingFixText: {
    color: '#E2E2E2',
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: 'rgba(28, 27, 28, 0.9)',
    borderWidth: 1,
    borderColor: '#363435',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
  },
  markerContainer: {
    backgroundColor: '#131314',
    padding: 6,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFEA00',
  },
  markerEmoji: {
    fontSize: 16,
  },
  mapOverlayFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(19, 19, 20, 0.9)',
    borderTopWidth: 1,
    borderTopColor: '#363435',
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  locationLabel: {
    color: '#8E9192',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  locationCoords: {
    color: '#FFEA00',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  accuracyTag: {
    color: '#FFEA00',
    fontSize: 10,
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#1C1B1C',
    borderWidth: 1,
    borderColor: '#363435',
    borderRadius: 4,
    padding: 10,
    alignItems: 'center',
  },
  metricLabel: {
    color: '#8E9192',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  metricValue: {
    color: '#E2E2E2',
    fontSize: 18,
    fontWeight: '800',
  },
  metricUnit: {
    color: '#8E9192',
    fontSize: 9,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: '#1C1B1C',
    borderWidth: 1,
    borderColor: '#363435',
    borderRadius: 4,
    padding: 12,
    marginBottom: 14,
  },
  cardDisabled: {
    opacity: 0.6,
  },
  cardDanger: {
    borderColor: '#EF4444',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#FFEA00',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  statusText: {
    color: '#8E9192',
    fontSize: 10,
  },
  cardSubtext: {
    color: '#8E9192',
    fontSize: 11,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  freqChip: {
    flex: 1,
    backgroundColor: '#2B292A',
    borderWidth: 1,
    borderColor: '#363435',
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  freqChipActive: {
    backgroundColor: 'rgba(255, 234, 0, 0.15)',
    borderColor: '#FFEA00',
  },
  freqChipText: {
    color: '#8E9192',
    fontSize: 9,
    fontWeight: '700',
  },
  freqChipTextActive: {
    color: '#FFEA00',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logsContainer: {
    marginTop: 8,
    backgroundColor: '#0E0E0F',
    borderRadius: 4,
    padding: 8,
  },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1B1C',
  },
  logTime: {
    color: '#FFEA00',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  logMsg: {
    color: '#8E9192',
    fontSize: 10,
  },
  logHighlight: {
    color: '#FFEA00',
    fontWeight: '700',
  },
  actionBtnDanger: {
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 4,
    marginTop: 6,
  },
  actionBtnTextDanger: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  logoutBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutBtnText: {
    color: '#8E9192',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 65,
    backgroundColor: '#131314',
    borderTopWidth: 1,
    borderTopColor: '#363435',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  navLabel: {
    color: '#8E9192',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
  },
  navLabelActive: {
    color: '#FFEA00',
  },
});
