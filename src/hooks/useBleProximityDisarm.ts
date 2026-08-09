import { useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';
import { BleManager, Device } from 'react-native-ble-plx';
import {
  BLE_SERVICE_UUID,
  CHAR_CHALLENGE_NONCE_UUID,
  CHAR_HMAC_RESPONSE_UUID,
  PROXIMITY_RSSI_THRESHOLD,
  computeHmacResponse,
  isPairedDevice,
  isWithinProximity,
} from '../services/ble';

const bleManager = new BleManager();

// Paused: the claim flow (see ADR-0007) never issues a device_secret to the app — it's
// generated at flash time and stored hashed only, so `deviceSecret` here can never be
// populated as designed. See issue #24 before re-enabling.
export const BLE_AUTO_DISARM_ENABLED = false;

export function useBleProximityDisarm(
  deviceSecret: string | null,
  isArmed: boolean,
  pairedDeviceId: string | null,
  onDevicePaired: (deviceId: string) => void
) {
  const [scanning, setScanning] = useState<boolean>(false);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [currentRssi, setCurrentRssi] = useState<number | null>(null);
  const [disarmStatus, setDisarmStatus] = useState<string>('Idle');

  useEffect(() => {
    if (!BLE_AUTO_DISARM_ENABLED) {
      setDisarmStatus('Auto-disarm paused pending eBike-GPS-Tracker#28 (see issue #24)');
      return;
    }

    if (!isArmed || !deviceSecret) {
      if (scanning) {
        bleManager.stopDeviceScan();
        setScanning(false);
      }
      setDisarmStatus(deviceSecret ? 'Idle' : 'Auto-disarm unavailable: no device secret provisioned');
      return;
    }

    setScanning(true);
    setDisarmStatus('Scanning for eBike Tracker BLE...');

    bleManager.startDeviceScan(
      [BLE_SERVICE_UUID],
      { allowDuplicates: false },
      async (error: any, device: any) => {
        if (error) {
          setDisarmStatus(`Scan Error: ${error.message}`);
          setScanning(false);
          return;
        }

        if (!device || device.rssi === null) return;

        // The service UUID is public and trivially spoofable by any nearby BLE peripheral,
        // so only proceed with the board this app has previously completed a handshake with.
        if (!isPairedDevice(device.id, pairedDeviceId)) return;

        setCurrentRssi(device.rssi);

        if (!isWithinProximity(device.rssi)) {
          setDisarmStatus(`Out of Proximity (${device.rssi} dBm < ${PROXIMITY_RSSI_THRESHOLD} dBm)`);
          return;
        }

        bleManager.stopDeviceScan();
        setScanning(false);
        setDisarmStatus(`Proximity Matched (${device.rssi} dBm). Connecting...`);

        try {
          const connected = await device.connect();
          setConnectedDevice(connected);
          await connected.discoverAllServicesAndCharacteristics();

          // 1. Read 16-byte random challenge nonce from characteristic EBT2
          const nonceChar = await connected.readCharacteristicForService(
            BLE_SERVICE_UUID,
            CHAR_CHALLENGE_NONCE_UUID
          );

          if (nonceChar.value) {
            // Decode base64 to hex using CryptoJS
            const nonceHex = CryptoJS.enc.Base64.parse(nonceChar.value).toString(CryptoJS.enc.Hex);
            setDisarmStatus('Computing HMAC-SHA256 Challenge...');

            // 2. Compute HMAC-SHA256(nonceHex, deviceSecret)
            const hmacHex = computeHmacResponse(nonceHex, deviceSecret);
            const hmacBase64 = CryptoJS.enc.Hex.parse(hmacHex).toString(CryptoJS.enc.Base64);

            // 3. Write 32-byte HMAC response to characteristic EBT3
            await connected.writeCharacteristicWithResponseForService(
              BLE_SERVICE_UUID,
              CHAR_HMAC_RESPONSE_UUID,
              hmacBase64
            );

            if (!pairedDeviceId) {
              onDevicePaired(connected.id);
            }

            setDisarmStatus('🎉 Disarm Handshake Successful! (0ms Mute)');
          }
        } catch (err: any) {
          setDisarmStatus(`Handshake Failed: ${err.message || 'BLE error'}`);
        }
      }
    );

    return () => {
      bleManager.stopDeviceScan();
    };
  }, [isArmed, deviceSecret, pairedDeviceId]);

  return {
    scanning,
    currentRssi,
    disarmStatus,
    connectedDevice,
  };
}
