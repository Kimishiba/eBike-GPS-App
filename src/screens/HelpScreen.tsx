import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';

interface HelpScreenProps {
  onBack: () => void;
}

export const HelpScreen: React.FC<HelpScreenProps> = ({ onBack }) => {
  const faqs = [
    {
      q: 'HOW DOES CELLULAR UPLINK WORK?',
      a: 'The board contains an integrated LTE modem. Telemetry data is streamed over MQTT directly to the server every 30s-15m depending on frequency settings.',
    },
    {
      q: 'WHAT IS BLE PROXIMITY AUTO-DISARM?',
      a: 'When you walk up to your bike with your paired phone, the board authenticates your phone over BLE using an HMAC-SHA256 challenge before disarming the siren.',
    },
    {
      q: 'HOW DO I FACTORY RESET A BOARD?',
      a: 'Toggle the ignition line (POWER_SENSE_PIN) 3 times within 10 seconds while the board is DISARMED. If armed, this triggers tamper siren.',
    },
    {
      q: 'REMOTE MOTOR KILL SAFETY INTERLOCK',
      a: 'Remote motor cutoff requires biometric authentication (FaceID/Fingerprint) and will only execute if bike speed is verified under 5 km/h.',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#131314" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>HELP & FAQ</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.emblemWrapper}>
          <Text style={styles.brandTitle}>IRON STEED KINETIC</Text>
          <Text style={styles.brandSubtitle}>SYSTEM DOCUMENTATION & PROTOCOLS</Text>
        </View>

        {faqs.map((faq, idx) => (
          <View key={idx} style={styles.faqCard}>
            <Text style={styles.faqQuestion}>{faq.q}</Text>
            <Text style={styles.faqAnswer}>{faq.a}</Text>
          </View>
        ))}

        <TouchableOpacity style={styles.primaryBtn} onPress={onBack}>
          <Text style={styles.btnText}>RETURN TO DASHBOARD</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#363435',
  },
  backBtn: {
    marginRight: 16,
  },
  backBtnText: {
    color: '#FFEA00',
    fontSize: 12,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#FFEA00',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  scrollContent: {
    padding: 20,
  },
  emblemWrapper: {
    marginBottom: 20,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFEA00',
    letterSpacing: 1.5,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E9192',
    letterSpacing: 1,
    marginTop: 4,
  },
  faqCard: {
    backgroundColor: '#1C1B1C',
    borderWidth: 1,
    borderColor: '#363435',
    borderRadius: 4,
    padding: 16,
    marginBottom: 12,
  },
  faqQuestion: {
    color: '#FFEA00',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  faqAnswer: {
    color: '#E2E2E2',
    fontSize: 13,
    lineHeight: 18,
  },
  primaryBtn: {
    backgroundColor: '#FFEA00',
    paddingVertical: 14,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 16,
  },
  btnText: {
    color: '#131314',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});
