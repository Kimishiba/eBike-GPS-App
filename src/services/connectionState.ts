export type ConnectionState = 'CONNECTING' | 'LIVE' | 'STALE' | 'DISCONNECTED';

// If no fresh frame arrives within this window, the last-known values are
// shown as stale rather than silently passed off as live.
export const STALE_AFTER_MS = 90_000;

export function deriveConnectionState(
  lastFrameAt: number | null,
  lastErrorAt: number | null,
  now: number = Date.now()
): ConnectionState {
  if (lastFrameAt === null) {
    return lastErrorAt !== null ? 'DISCONNECTED' : 'CONNECTING';
  }
  if (lastErrorAt !== null && lastErrorAt >= lastFrameAt) {
    return 'DISCONNECTED';
  }
  return now - lastFrameAt > STALE_AFTER_MS ? 'STALE' : 'LIVE';
}

export function connectionBadgeLabel(state: ConnectionState): string {
  switch (state) {
    case 'LIVE':
      return '🟢 LIVE (Fly.io)';
    case 'STALE':
      return '🟡 STALE';
    case 'DISCONNECTED':
      return '🔴 DISCONNECTED';
    case 'CONNECTING':
    default:
      return '⚪ CONNECTING';
  }
}
