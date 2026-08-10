import * as SecureStore from 'expo-secure-store';

const deviceSecretKey = (bikeId: string) => `ebike_${bikeId}_device_secret`;
const pairedBleDeviceIdKey = (bikeId: string) => `ebike_${bikeId}_paired_ble_device_id`;
const AUTH_TOKEN_KEY = 'ebike_user_auth_token';

export function getAuthToken(): Promise<string | null> {
  return SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
}

export function deleteAuthToken(): Promise<void> {
  return SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}

export function getDeviceSecret(bikeId: string): Promise<string | null> {
  return SecureStore.getItemAsync(deviceSecretKey(bikeId));
}

export function setDeviceSecret(bikeId: string, secret: string): Promise<void> {
  return SecureStore.setItemAsync(deviceSecretKey(bikeId), secret);
}

/**
 * The BLE device id the auto-disarm handshake last succeeded against for this bike.
 * Used to pin future handshakes to the same physical board instead of trusting any
 * advertiser of the (public, spoofable) service UUID.
 */
export function getPairedBleDeviceId(bikeId: string): Promise<string | null> {
  return SecureStore.getItemAsync(pairedBleDeviceIdKey(bikeId));
}

export function setPairedBleDeviceId(bikeId: string, deviceId: string): Promise<void> {
  return SecureStore.setItemAsync(pairedBleDeviceIdKey(bikeId), deviceId);
}
