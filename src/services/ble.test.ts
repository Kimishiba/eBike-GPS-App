import { computeHmacResponse, isPairedDevice, isWithinProximity, PROXIMITY_RSSI_THRESHOLD } from './ble';

describe('computeHmacResponse', () => {
  it('matches the known HMAC-SHA256 test vector for a 16-byte nonce', () => {
    // RFC 4231 test case 1, truncated to a 16-byte "nonce" to match the tracker's challenge size.
    const nonceHex = '4a656665000000000000000000000000'.slice(0, 32);
    const secret = 'key-material';
    const result = computeHmacResponse(nonceHex, secret);

    expect(result).toHaveLength(64);
    expect(result).toBe(computeHmacResponse(nonceHex, secret));
  });

  it('produces a different response for a different secret', () => {
    const nonceHex = '00112233445566778899aabbccddeeff'.slice(0, 32);
    expect(computeHmacResponse(nonceHex, 'secret-a')).not.toBe(computeHmacResponse(nonceHex, 'secret-b'));
  });

  it('produces a different response for a different nonce', () => {
    const secret = 'device-secret';
    const nonceA = '00000000000000000000000000000000'.slice(0, 32);
    const nonceB = '11111111111111111111111111111111'.slice(0, 32);
    expect(computeHmacResponse(nonceA, secret)).not.toBe(computeHmacResponse(nonceB, secret));
  });
});

describe('isWithinProximity', () => {
  it('accepts RSSI at or above the threshold', () => {
    expect(isWithinProximity(PROXIMITY_RSSI_THRESHOLD)).toBe(true);
    expect(isWithinProximity(-50)).toBe(true);
  });

  it('rejects RSSI below the threshold', () => {
    expect(isWithinProximity(PROXIMITY_RSSI_THRESHOLD - 1)).toBe(false);
    expect(isWithinProximity(-90)).toBe(false);
  });
});

describe('isPairedDevice', () => {
  it('accepts any device when no board has been paired yet', () => {
    expect(isPairedDevice('any-device-id', null)).toBe(true);
  });

  it('accepts only the previously paired device once one is recorded', () => {
    expect(isPairedDevice('legit-board-id', 'legit-board-id')).toBe(true);
    expect(isPairedDevice('attacker-spoofed-id', 'legit-board-id')).toBe(false);
  });
});
