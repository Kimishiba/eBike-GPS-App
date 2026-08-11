const DEFAULT_API_BASE_URL = 'https://velo-lock-tracker.fly.dev';

export interface AuthResponse {
  success: boolean;
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export interface ClaimRequest {
  claimCode: string;
  nickname: string;
  geofenceRadiusMeters?: number;
}

export interface ClaimResponse {
  success: boolean;
  bike: {
    id: string;
    hardwareId: string;
    nickname: string;
    ownerId: string;
    geofenceRadiusMeters: number;
    createdAt: string;
    deviceSecret?: string;
  };
}

export async function loginApi(
  email: string,
  pass: string,
  apiBaseUrl: string = DEFAULT_API_BASE_URL
): Promise<AuthResponse> {
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Login failed' }));
    throw new Error(errorData.message || `Login failed with status ${response.status}`);
  }

  return response.json();
}

export async function registerApi(
  email: string,
  pass: string,
  name: string,
  apiBaseUrl: string = DEFAULT_API_BASE_URL
): Promise<AuthResponse> {
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass, name }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Registration failed' }));
    throw new Error(errorData.message || `Registration failed with status ${response.status}`);
  }

  return response.json();
}

export async function claimBoardApi(
  payload: ClaimRequest,
  token?: string | null,
  apiBaseUrl: string = DEFAULT_API_BASE_URL
): Promise<ClaimResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${apiBaseUrl}/api/v1/bikes/claim`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to claim board' }));
    throw new Error(errorData.message || `Claim failed with status ${response.status}`);
  }

  return response.json();
}

export interface MyBikesResponse {
  success: boolean;
  bikes: Array<{
    id: string;
    hardwareId: string;
    nickname: string;
    ownerId: string;
    createdAt: string;
  }>;
}

// Server-truth check for "does this logged-in user already own a bike" - used
// on app launch to recover the paired-bike state from the account itself
// instead of trusting only the local SecureStore flag, which is lost on
// reinstall/storage-clear even though the claim already succeeded server-side.
export async function getMyBikesApi(
  token?: string | null,
  apiBaseUrl: string = DEFAULT_API_BASE_URL
): Promise<MyBikesResponse> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${apiBaseUrl}/api/v1/bikes/mine`, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch owned bikes: status ${response.status}`);
  }

  return response.json();
}

export function subscribeTelemetryApi(
  onTelemetry: (data: any) => void,
  apiBaseUrl: string = DEFAULT_API_BASE_URL
): () => void {
  const credentials = btoa('admin:VeloDashAdmin2026!');
  
  // Connect to live Fly.io SSE stream with Basic Auth
  const eventSource = new EventSource(`${apiBaseUrl}/api/events`, {
    headers: { Authorization: `Basic ${credentials}` },
  } as EventSourceInit);

  const messageHandler = (event: any) => {
    try {
      const data = JSON.parse(event.data);
      if (data) onTelemetry(data);
    } catch (e) {
      // Ignore parse errors
    }
  };

  eventSource.addEventListener('telemetry', messageHandler);

  return () => {
    eventSource.removeEventListener('telemetry', messageHandler);
    eventSource.close();
  };
}

export async function sendIntervalCommandApi(
  bikeId: string,
  intervalSeconds: number,
  token?: string | null,
  apiBaseUrl: string = DEFAULT_API_BASE_URL
): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + btoa('admin:VeloDashAdmin2026!'),
  };

  const intervalMs = intervalSeconds * 1000;
  const payload = JSON.stringify({
    interval: intervalMs,
    intervalSeconds,
    intervalMs,
  });

  // Try standard v1 endpoint path
  let response = await fetch(`${apiBaseUrl}/api/v1/bikes/${bikeId}/config/interval`, {
    method: 'POST',
    headers,
    body: payload,
  }).catch(() => null);

  // Fallback to legacy endpoint path if v1 returns 404 or fails
  if (!response || !response.ok) {
    response = await fetch(`${apiBaseUrl}/api/config/interval`, {
      method: 'POST',
      headers,
      body: payload,
    }).catch(() => null);
  }

  if (!response || !response.ok) {
    const statusText = response ? `status ${response.status}` : 'network error';
    throw new Error(`Interval update failed: ${statusText}`);
  }

  return response.json();
}
