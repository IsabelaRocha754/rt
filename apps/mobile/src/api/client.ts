import Constants from "expo-constants";

const apiUrl: string = Constants.expoConfig?.extra?.apiUrl ?? "http://localhost:3000";

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${apiUrl}${path}`, init);
}
