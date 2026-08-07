const DEFAULT_API_BASE_URL = 'http://192.168.68.58:8181';

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
  };
}

export async function claimBoardApi(
  payload: ClaimRequest,
  apiBaseUrl: string = DEFAULT_API_BASE_URL
): Promise<ClaimResponse> {
  const response = await fetch(`${apiBaseUrl}/api/v1/bikes/claim`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to claim board' }));
    throw new Error(errorData.message || `Claim failed with status ${response.status}`);
  }

  return response.json();
}
