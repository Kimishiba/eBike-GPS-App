import CryptoJS from 'crypto-js';

// BLE Constants for eBike Tracker
export const BLE_SERVICE_UUID = '0000EBT1-0000-1000-8000-00805F9B34FB';
export const CHAR_CHALLENGE_NONCE_UUID = '0000EBT2-0000-1000-8000-00805F9B34FB';
export const CHAR_HMAC_RESPONSE_UUID = '0000EBT3-0000-1000-8000-00805F9B34FB';
export const CHAR_STATUS_UUID = '0000EBT4-0000-1000-8000-00805F9B34FB';

// RSSI Proximity Gate (-75 dBm = approx 2-3 meters)
export const PROXIMITY_RSSI_THRESHOLD = -75;

export interface BleDisarmResult {
  success: boolean;
  rssi: number;
  message: string;
}

/**
 * Computes HMAC-SHA256 of the 16-byte challenge nonce using the device secret.
 * @param challengeNonceHex 16-byte hex string (32 characters)
 * @param deviceSecret Plaintext device secret string
 * @returns 32-byte HMAC-SHA256 hex string (64 characters)
 */
export function computeHmacResponse(challengeNonceHex: string, deviceSecret: string): string {
  const nonceWords = CryptoJS.enc.Hex.parse(challengeNonceHex);
  const hmac = CryptoJS.HmacSHA256(nonceWords, deviceSecret);
  return CryptoJS.enc.Hex.stringify(hmac);
}

/**
 * Evaluates whether a scanned BLE device meets proximity gating conditions.
 */
export function isWithinProximity(rssi: number): boolean {
  return rssi >= PROXIMITY_RSSI_THRESHOLD;
}

/**
 * Gates the handshake to the specific board this app previously paired with, rather than any
 * advertiser of the (public, spoofable) service UUID. `pairedDeviceId` is null only before the
 * very first successful handshake for a bike, when there's nothing yet to pin against.
 */
export function isPairedDevice(deviceId: string, pairedDeviceId: string | null): boolean {
  return pairedDeviceId === null || deviceId === pairedDeviceId;
}
