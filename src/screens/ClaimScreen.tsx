import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { claimBoardApi } from '../services/api';
import { setDeviceSecret } from '../services/secureStorage';

interface ClaimScreenProps {
  onClaimSuccess: (bikeData: any) => void;
}

export const ClaimScreen: React.FC<ClaimScreenProps> = ({ onClaimSuccess }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<1 | 2>(1);
  const [manualMode, setManualMode] = useState<boolean>(false);

  // Form State
  const [hardwareId, setHardwareId] = useState<string>('');
  const [claimCode, setClaimCode] = useState<string>('');
  const [nickname, setNickname] = useState<string>('My eBike');
  const [geofenceRadius, setGeofenceRadius] = useState<number>(100);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Handle QR Code Scan
  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (step !== 1) return;

    try {
      if (data.startsWith('ebike://claim')) {
        const idMatch = data.match(/[?&]id=([^&]+)/);
        const codeMatch = data.match(/[?&]code=([^&]+)/);

        if (idMatch && codeMatch) {
          setHardwareId(idMatch[1]);
          setClaimCode(codeMatch[2].toUpperCase());
          setStep(2);
          return;
        }
      }

      // Direct fallback parsing for query params or raw text
      if (data.includes('code=')) {
        const matchCode = data.match(/code=([A-Za-z0-9_-]+)/i);
        const matchId = data.match(/id=([a-f0-9-]{36})/i);
        if (matchCode) setClaimCode(matchCode[1].toUpperCase());
        if (matchId) setHardwareId(matchId[1]);
        setStep(2);
        return;
      }

      // Raw text code fallback
      if (data.trim().length >= 4) {
        setClaimCode(data.trim().toUpperCase());
        setStep(2);
        return;
      }

      Alert.alert('Invalid QR Code', 'Please scan a valid eBike Tracker packaging QR code.');
    } catch (err) {
      Alert.alert('Scan Error', 'Unable to parse scanned QR payload.');
    }
  };

  const handleManualNext = () => {
    const cleanCode = claimCode.trim().toUpperCase();
    if (cleanCode.length < 3) {
      Alert.alert('Invalid Claim Code', 'Please enter a valid claim code.');
      return;
    }
    setClaimCode(cleanCode);
    setStep(2);
  };

  const handleSubmitClaim = async () => {
    if (!nickname.trim()) {
      Alert.alert('Missing Nickname', 'Please enter a name for your eBike.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await claimBoardApi({
        hardwareId: hardwareId || 'b2c13223-08c0-4ff7-b6de-47f9a53e5ba1',
        claimCode,
        nickname: nickname.trim(),
        geofenceRadiusMeters: geofenceRadius,
      });

      const { deviceSecret, ...bikeWithoutSecret } = response.bike;
      if (deviceSecret) {
        await setDeviceSecret(response.bike.id, deviceSecret);
      }

      Alert.alert('🎉 Board Paired!', `Successfully paired "${response.bike.nickname}" to your account.`, [
        {
          text: 'Open Map Dashboard',
          onPress: () => onClaimSuccess(bikeWithoutSecret),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Pairing Failed', error.message || 'Failed to claim board.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted && step === 1 && !manualMode) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionBox}>
          <Text style={styles.headerTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            We need camera access to scan the QR code printed on your tracker packaging.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
            <Text style={styles.btnText}>Grant Camera Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setManualMode(true)}>
            <Text style={styles.secondaryBtnText}>Enter Code Manually</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {step === 1 ? 'Step 1: Pair Your Board' : 'Step 2: Customise eBike Profile'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {step === 1
              ? 'Scan the QR code on your board packaging to claim Ownership.'
              : 'Set a nickname and home safe-zone geofence for your eBike.'}
          </Text>
        </View>

        {step === 1 && !manualMode && (
          <View style={styles.cameraWrapper}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
              onBarcodeScanned={handleBarcodeScanned}
            >
              <View style={styles.overlayContainer}>
                <View style={styles.scanFrame} />
                <Text style={styles.scanHint}>Align QR code within the frame</Text>
              </View>
            </CameraView>
            <TouchableOpacity style={styles.manualSwitchBtn} onPress={() => setManualMode(true)}>
              <Text style={styles.manualSwitchText}>⌨️ Enter Claim Code Manually</Text>
            </TouchableOpacity>
          </View>
        )}

        {(step === 1 && manualMode) && (
          <ScrollView contentContainerStyle={styles.formContainer}>
            <Text style={styles.label}>8-Character Claim Code</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 7K9A2X4M"
              placeholderTextColor="#666"
              value={claimCode}
              onChangeText={(val) => setClaimCode(val.toUpperCase())}
              maxLength={8}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <Text style={styles.label}>Hardware UUID (Optional if on packaging)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. b2c13223-08c0-4ff7-b6de-47f9a53e5ba1"
              placeholderTextColor="#666"
              value={hardwareId}
              onChangeText={setHardwareId}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity style={styles.primaryBtn} onPress={handleManualNext}>
              <Text style={styles.btnText}>Next Step →</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setManualMode(false)}>
              <Text style={styles.secondaryBtnText}>📷 Switch to Camera Scanner</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {step === 2 && (
          <ScrollView contentContainerStyle={styles.formContainer}>
            <Text style={styles.label}>eBike Nickname</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Specialized Turbo Vado"
              placeholderTextColor="#666"
              value={nickname}
              onChangeText={setNickname}
            />

            <Text style={styles.label}>Home Safe Zone Geofence ({geofenceRadius} meters)</Text>
            <View style={styles.geofenceRow}>
              {[50, 100, 250, 500].map((radius) => (
                <TouchableOpacity
                  key={radius}
                  style={[
                    styles.radiusChip,
                    geofenceRadius === radius && styles.radiusChipActive,
                  ]}
                  onPress={() => setGeofenceRadius(radius)}
                >
                  <Text
                    style={[
                      styles.radiusChipText,
                      geofenceRadius === radius && styles.radiusChipTextActive,
                    ]}
                  >
                    {radius}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Board Summary</Text>
              <Text style={styles.summaryItem}>• Claim Token: {claimCode}</Text>
              <Text style={styles.summaryItem}>
                • Hardware ID: {hardwareId || 'Default Prototyping Board'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, isSubmitting && styles.btnDisabled]}
              onPress={handleSubmitClaim}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.btnText}>Confirm & Pair Board 🚲</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(1)}>
              <Text style={styles.secondaryBtnText}>← Back to Scan</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  permissionText: {
    fontSize: 15,
    color: '#CBD5E1',
    marginVertical: 16,
    lineHeight: 22,
  },
  cameraWrapper: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlayContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#38BDF8',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  scanHint: {
    marginTop: 20,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  manualSwitchBtn: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#334155',
  },
  manualSwitchText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
  formContainer: {
    padding: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#F8FAFC',
  },
  geofenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  radiusChip: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  radiusChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  radiusChipText: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  radiusChipTextActive: {
    color: '#FFF',
  },
  summaryCard: {
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
    marginVertical: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38BDF8',
    marginBottom: 8,
  },
  summaryItem: {
    fontSize: 13,
    color: '#CBD5E1',
    marginVertical: 2,
  },
  primaryBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryBtnText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
});
