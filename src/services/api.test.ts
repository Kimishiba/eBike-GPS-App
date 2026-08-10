import { fetchLatestTelemetryApi, sendIntervalCommandApi } from './api';

describe('fetchLatestTelemetryApi', () => {
  afterEach(() => {
    (globalThis as any).fetch = undefined;
  });

  it('sends the caller-provided bearer token, not a shared admin credential', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ latitude: 1, longitude: 2 }),
    });
    (globalThis as any).fetch = fetchMock;

    await fetchLatestTelemetryApi('bike-123', 'user-jwt-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/bikes/bike-123/telemetry/latest');
    expect(options.headers.Authorization).toBe('Bearer user-jwt-token');
    expect(options.headers.Authorization).not.toMatch(/Basic/);
  });

  it('throws when the response is not ok', async () => {
    (globalThis as any).fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
    await expect(fetchLatestTelemetryApi('bike-123', 'token')).rejects.toThrow(/401/);
  });
});

describe('sendIntervalCommandApi', () => {
  afterEach(() => {
    (globalThis as any).fetch = undefined;
  });

  it('sends the caller-provided bearer token, not a shared admin credential', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ command_id: 'cmd-1' }),
    });
    (globalThis as any).fetch = fetchMock;

    await sendIntervalCommandApi('bike-123', 60, 'user-jwt-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer user-jwt-token');
    expect(options.headers.Authorization).not.toMatch(/Basic/);
  });

  it('omits the Authorization header entirely when no token is available', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    (globalThis as any).fetch = fetchMock;

    await sendIntervalCommandApi('bike-123', 60, null);

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });
});
