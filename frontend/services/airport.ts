import { apiRequest, methodUrl } from "./apiClient";

export async function fetchAllAirports() {
  return apiRequest<
    Array<{
      name: string;
      airport_name: string;
      iata_code: string;
      city: string;
      country: string;
    }>
  >(methodUrl("airport", "fetch_all_airports"), {
    method: "POST",
    body: JSON.stringify({}),
  });
}
