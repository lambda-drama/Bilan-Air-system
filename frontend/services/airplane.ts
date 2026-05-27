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
