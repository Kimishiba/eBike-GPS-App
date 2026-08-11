import { STALE_AFTER_MS, connectionBadgeLabel, deriveConnectionState } from './connectionState';

describe('deriveConnectionState', () => {
  const now = 1_000_000;

  it('is CONNECTING before any frame or error has been observed', () => {
    expect(deriveConnectionState(null, null, now)).toBe('CONNECTING');
  });

  it('is DISCONNECTED when an error occurs before any frame arrives', () => {
    expect(deriveConnectionState(null, now, now)).toBe('DISCONNECTED');
  });

  it('is LIVE just after a frame arrives with no error', () => {
    expect(deriveConnectionState(now, null, now)).toBe('LIVE');
  });

  it('is STALE once the freshness window elapses with no new frame', () => {
    const lastFrameAt = now - STALE_AFTER_MS - 1;
    expect(deriveConnectionState(lastFrameAt, null, now)).toBe('STALE');
  });

  it('is DISCONNECTED when the most recent error is newer than the most recent frame', () => {
    const lastFrameAt = now - 1000;
    const lastErrorAt = now - 500;
    expect(deriveConnectionState(lastFrameAt, lastErrorAt, now)).toBe('DISCONNECTED');
  });

  it('is LIVE again when a fresh frame arrives after a prior error', () => {
    const lastErrorAt = now - 5000;
    const lastFrameAt = now - 100;
    expect(deriveConnectionState(lastFrameAt, lastErrorAt, now)).toBe('LIVE');
  });
});

describe('connectionBadgeLabel', () => {
  it('renders a distinct label for every state', () => {
    const labels = ['CONNECTING', 'LIVE', 'STALE', 'DISCONNECTED'].map((s) =>
      connectionBadgeLabel(s as any)
    );
    expect(new Set(labels).size).toBe(4);
  });
});
