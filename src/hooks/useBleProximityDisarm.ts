import { useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';
import { BleManager, Device } from 'react-native-ble-plx';
import {
  BLE_SERVICE_UUID,
  CHAR_CHALLENGE_NONCE_UUID,
  CHAR_HMAC_RESPONSE_UUID,
  PROXIMITY_RSSI_THRESHOLD,
  computeHmacResponse,
  isWithinProximity,
} from '../services/ble';

const bleManager = new BleManager();

export function useBleProximityDisarm(deviceSecret: string, isArmed: boolean) {
  const [scanning, setScanning] = useState<boolean>(false);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [currentRssi, setCurrentRssi] = useState<number | null>(null);
  const [disarmStatus, setDisarmStatus] = useState<string>('Idle');

  useEffect(() => {
    if (!isArmed || !deviceSecret) {
      if (scanning) {
        bleManager.stopDeviceScan();
        setScanning(false);
      }
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

        if (device && device.rssi !== null) {
          setCurrentRssi(device.rssi);

          // Check RSSI Proximity Gate (>= -75 dBm)
          if (isWithinProximity(device.rssi)) {
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

                setDisarmStatus('🎉 Disarm Handshake Successful! (0ms Mute)');
              }
            } catch (err: any) {
              setDisarmStatus(`Handshake Failed: ${err.message || 'BLE error'}`);
            }
          } else {
            setDisarmStatus(`Out of Proximity (${device.rssi} dBm < ${PROXIMITY_RSSI_THRESHOLD} dBm)`);
          }
        }
      }
    );

    return () => {
      bleManager.stopDeviceScan();
    };
  }, [isArmed, deviceSecret]);

  return {
    scanning,
    currentRssi,
    disarmStatus,
    connectedDevice,
  };
}
