import React from 'react';
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

interface AccountScreenProps {
  onLogout: () => void;
  onNavigateHelp: () => void;
}

export const AccountScreen: React.FC<AccountScreenProps> = ({ onLogout, onNavigateHelp }) => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#131314" />
      <View style={styles.header}>
        <Text style={styles.brandTitle}>OPERATOR PROFILE</Text>
        <Text style={styles.headerSubtitle}>SYSTEM SETTINGS & AUTHENTICATION PROTOCOLS</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <View style={styles.sectionCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarIcon}>👤</Text>
            </View>
            <View>
              <Text style={styles.profileName}>EBIKE OPERATOR</Text>
              <Text style={styles.profileRole}>ROLE: VEHICLE OWNER (ADMIN)</Text>
            </View>
          </View>

          <View style={styles.specRow}>
            <Text style={styles.specLabel}>AUTHENTICATION TOKEN</Text>
            <Text style={styles.specVal}>JWT (SHA-256 Validated)</Text>
          </View>
          <View style={styles.specRow}>
            <Text style={styles.specLabel}>BIOMETRICS SECURITY</Text>
            <Text style={styles.specVal}>FaceID / Fingerprint Active</Text>
          </View>
          <View style={styles.specRow}>
            <Text style={styles.specLabel}>MQTT BROKER UPLINK</Text>
            <Text style={styles.specVal}>velo-lock-tracker.fly.dev:1883</Text>
          </View>
        </View>

        {/* Quick Links */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>SYSTEM UTILITIES</Text>

          <TouchableOpacity style={styles.linkRow} onPress={onNavigateHelp}>
            <Text style={styles.linkLabel}>📘 HELP & SYSTEM DOCUMENTATION</Text>
            <Text style={styles.linkArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Logout Action */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => {
            Alert.alert('Confirm Logout', 'Are you sure you want to log out of Iron Steed?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Log Out', style: 'destructive', onPress: onLogout },
            ]);
          }}
        >
          <Text style={styles.logoutBtnText}>LOG OUT OPERATOR SESSION</Text>
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
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0E0E0F',
    borderWidth: 1,
    borderColor: '#FFEA00',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarIcon: {
    fontSize: 24,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#E2E2E2',
    letterSpacing: 1,
  },
  profileRole: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFEA00',
    letterSpacing: 1,
    marginTop: 2,
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
    fontSize: 11,
    fontWeight: '600',
  },
  sectionTitle: {
    color: '#FFEA00',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  linkLabel: {
    color: '#E2E2E2',
    fontSize: 12,
    fontWeight: '600',
  },
  linkArrow: {
    color: '#FFEA00',
    fontSize: 16,
    fontWeight: '700',
  },
  logoutBtn: {
    backgroundColor: '#2B292A',
    borderWidth: 1,
    borderColor: '#363435',
    paddingVertical: 14,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 10,
  },
  logoutBtnText: {
    color: '#8E9192',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
