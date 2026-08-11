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
  StatusBar,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { claimBoardApi } from '../services/api';
import { setDeviceSecret } from '../services/secureStorage';

interface ClaimScreenProps {
  authToken: string | null;
  onClaimSuccess: (bikeData: any) => void;
  onLogout: () => void;
}

export const ClaimScreen: React.FC<ClaimScreenProps> = ({ authToken, onClaimSuccess, onLogout }) => {
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
  const handleBarcodeScanned = (scanningResult: any) => {
    if (step !== 1) return;

    let rawData = '';
    if (typeof scanningResult === 'string') {
      rawData = scanningResult;
    } else if (scanningResult && typeof scanningResult.data === 'string') {
      rawData = scanningResult.data;
    } else if (scanningResult && scanningResult.data && typeof scanningResult.data.text === 'string') {
      rawData = scanningResult.data.text;
    }

    if (!rawData || typeof rawData !== 'string') return;

    try {
      if (rawData.startsWith('ebike://claim')) {
        const idMatch = rawData.match(/[?&]id=([^&]+)/);
        const codeMatch = rawData.match(/[?&]code=([^&]+)/);

        const foundId = idMatch && idMatch[1] ? idMatch[1] : '';
        const foundCode = codeMatch && codeMatch[1] ? codeMatch[1] : '';

        if (foundCode) {
          if (foundId) setHardwareId(foundId);
          setClaimCode(foundCode.toUpperCase());
          setStep(2);
          return;
        }
      }

      if (rawData.includes('code=')) {
        const matchCode = rawData.match(/code=([A-Za-z0-9_-]+)/i);
        const matchId = rawData.match(/id=([a-f0-9-]{36})/i);
        if (matchCode && matchCode[1]) setClaimCode(matchCode[1].toUpperCase());
        if (matchId && matchId[1]) setHardwareId(matchId[1]);
        setStep(2);
        return;
      }

      if (rawData.trim().length >= 3) {
        setClaimCode(rawData.trim().toUpperCase());
        setStep(2);
        return;
      }

      Alert.alert('Invalid QR Code', `Scanned payload: ${rawData}`);
    } catch (err: any) {
      Alert.alert('Scan Error', `Unable to parse: ${err.message || err}`);
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
      const response = await claimBoardApi(
        {
          claimCode,
          nickname: nickname.trim(),
          geofenceRadiusMeters: geofenceRadius,
        },
        authToken
      );

      const { deviceSecret, ...bikeWithoutSecret } = response.bike;
      if (deviceSecret) {
        await setDeviceSecret(response.bike.id, deviceSecret);
      }

      Alert.alert('🎉 Board Paired!', `Successfully paired "${response.bike.nickname}" to your account.`, [
        {
          text: 'Open Dashboard',
          onPress: () => onClaimSuccess(bikeWithoutSecret),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Pairing Failed', error?.message || 'Unable to claim this board. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#131314" />

      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.brandRow}>
            <Text style={styles.brandIcon}>🛡️</Text>
            <Text style={styles.brandTitle}>IRON STEED</Text>
          </View>
          <TouchableOpacity onPress={onLogout}>
            <Text style={styles.logoutLink}>LOG OUT</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>
          {step === 1 ? 'PAIRS & CLAIMS A NEW TRACKER BOARD' : 'SETUP EBIKE PROFILE & SAFE ZONE'}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {step === 1 ? (
          <View style={{ flex: 1 }}>
            {!manualMode ? (
              <View style={styles.cameraWrapper}>
                {!permission.granted ? (
                  <View style={styles.permissionBox}>
                    <Text style={styles.permissionText}>
                      Camera permission is required to scan the hardware QR code sticker.
                    </Text>
                    <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
                      <Text style={styles.btnText}>GRANT CAMERA PERMISSION</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <CameraView
                    style={styles.camera}
                    facing="back"
                    onBarcodeScanned={handleBarcodeScanned}
                  >
                    <View style={styles.overlayContainer}>
                      <View style={styles.scanFrame} />
                      <Text style={styles.scanHint}>ALIGN STICKER QR INSIDE FRAME</Text>
                    </View>
                  </CameraView>
                )}

                <TouchableOpacity
                  style={styles.manualSwitchBtn}
                  onPress={() => setManualMode(true)}
                >
                  <Text style={styles.manualSwitchText}>ENTER CODE MANUALLY</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.formContainer}>
                <Text style={styles.label}>FACTORY CLAIM CODE</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. K9X2-M7PQ"
                  placeholderTextColor="#8E9192"
                  value={claimCode}
                  onChangeText={setClaimCode}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />

                <TouchableOpacity style={styles.primaryBtn} onPress={handleManualNext}>
                  <Text style={styles.btnText}>CONTINUE TO SETUP</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => setManualMode(false)}
                >
                  <Text style={styles.secondaryBtnText}>SWITCH BACK TO CAMERA SCANNER</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.formContainer}>
            <Text style={styles.label}>EBIKE NICKNAME</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Stealth Cruiser"
              placeholderTextColor="#8E9192"
              value={nickname}
              onChangeText={setNickname}
            />

            <Text style={styles.label}>DEFAULT SAFE ZONE GEOFENCE</Text>
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
              <Text style={styles.summaryTitle}>PAIRING SUMMARY</Text>
              <Text style={styles.summaryItem}>Claim Code: {claimCode}</Text>
              {hardwareId ? (
                <Text style={styles.summaryItem}>Hardware ID: {hardwareId.slice(0, 18)}...</Text>
              ) : null}
              <Text style={styles.summaryItem}>Safe Geofence Radius: {geofenceRadius} meters</Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, isSubmitting && styles.btnDisabled]}
              onPress={handleSubmitClaim}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#131314" />
              ) : (
                <Text style={styles.btnText}>CLAIM & PAIR EBIKE BOARD</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setStep(1)}
              disabled={isSubmitting}
            >
              <Text style={styles.secondaryBtnText}>BACK TO SCANNER</Text>
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
    backgroundColor: '#131314',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#363435',
    backgroundColor: '#131314',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutLink: {
    color: '#8E9192',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
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
  headerSubtitle: {
    fontSize: 10,
    color: '#8E9192',
    fontWeight: '700',
    letterSpacing: 1,
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  permissionText: {
    fontSize: 13,
    color: '#E2E2E2',
    marginVertical: 16,
    lineHeight: 20,
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
    backgroundColor: 'rgba(19, 19, 20, 0.5)',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#FFEA00',
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  scanHint: {
    marginTop: 20,
    color: '#FFEA00',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  manualSwitchBtn: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    backgroundColor: '#1C1B1C',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FFEA00',
  },
  manualSwitchText: {
    color: '#FFEA00',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  formContainer: {
    padding: 20,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFEA00',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#1C1B1C',
    borderWidth: 1,
    borderColor: '#363435',
    borderRadius: 4,
    padding: 14,
    fontSize: 14,
    color: '#E2E2E2',
  },
  geofenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
    gap: 6,
  },
  radiusChip: {
    flex: 1,
    backgroundColor: '#2B292A',
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#363435',
  },
  radiusChipActive: {
    backgroundColor: 'rgba(255, 234, 0, 0.15)',
    borderColor: '#FFEA00',
  },
  radiusChipText: {
    color: '#8E9192',
    fontSize: 11,
    fontWeight: '700',
  },
  radiusChipTextActive: {
    color: '#FFEA00',
  },
  summaryCard: {
    backgroundColor: '#1C1B1C',
    padding: 14,
    borderRadius: 4,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#363435',
  },
  summaryTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFEA00',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  summaryItem: {
    fontSize: 12,
    color: '#8E9192',
    marginVertical: 2,
  },
  primaryBtn: {
    backgroundColor: '#FFEA00',
    paddingVertical: 14,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 10,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#131314',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  secondaryBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryBtnText: {
    color: '#8E9192',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
