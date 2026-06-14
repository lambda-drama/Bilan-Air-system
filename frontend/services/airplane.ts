import { apiRequest, methodUrl } from "./apiClient";

export interface AirplaneRow {
  name: string;
  registration_number: string;
  aircraft_model: string;
  airline?: string;
  total_seats?: number;
}

export async function fetchAllAirplanes(): Promise<AirplaneRow[]> {
  return apiRequest(methodUrl("airplane", "fetch_all_airplanes"), {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fetchAirplaneSeatConfig(
  airplaneName: string,
): Promise<Array<Record<string, unknown>>> {
  const rows = await apiRequest<Array<Record<string, unknown>>>(
    methodUrl("airplane", "fetch_airplane_seat_config"),
    {
      method: "POST",
      body: JSON.stringify({ airplane_name: airplaneName }),
    },
  );
  return Array.isArray(rows) ? rows : [];
}
