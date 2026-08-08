declare module 'react-native-ble-plx' {
  export class Device {
    id: string;
    name?: string;
    rssi?: number | null;
    connect(): Promise<Device>;
    discoverAllServicesAndCharacteristics(): Promise<Device>;
    readCharacteristicForService(serviceUUID: string, characteristicUUID: string): Promise<any>;
    writeCharacteristicWithResponseForService(
      serviceUUID: string,
      characteristicUUID: string,
      base64Value: string
    ): Promise<any>;
  }

  export class BleManager {
    startDeviceScan(
      serviceUUIDs: string[] | null,
      options: any,
      callback: (error: any, device: Device | null) => void
    ): void;
    stopDeviceScan(): void;
  }
}

declare module 'react-native-maps' {
  export const Marker: any;
  export const Circle: any;
  export const Polyline: any;
  export const PROVIDER_DEFAULT: any;
  const MapView: any;
  export default MapView;
}

declare module 'expo-camera' {
  export const CameraView: any;
  export function useCameraPermissions(): [any, () => Promise<any>];
}

declare module 'expo-local-authentication' {
  export function hasHardwareAsync(): Promise<boolean>;
  export function authenticateAsync(options?: any): Promise<{ success: boolean }>;
}
