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
  hardwareId: string;
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

export async function fetchLatestTelemetryApi(
  bikeId: string,
  token?: string | null,
  apiBaseUrl: string = DEFAULT_API_BASE_URL
): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${apiBaseUrl}/api/v1/bikes/${bikeId}/telemetry/latest`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Telemetry fetch failed with status ${response.status}`);
  }

  return response.json();
}

export async function sendIntervalCommandApi(
  bikeId: string,
  intervalSeconds: number,
  token?: string | null,
  apiBaseUrl: string = DEFAULT_API_BASE_URL
): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${apiBaseUrl}/api/v1/bikes/${bikeId}/config/interval`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ intervalSeconds }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to update interval' }));
    throw new Error(errorData.message || `Interval update failed with status ${response.status}`);
  }

  return response.json();
}
