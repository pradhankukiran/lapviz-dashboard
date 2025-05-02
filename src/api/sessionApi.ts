// src/api/sessionApi.ts

// Define a type for the expected API response structure
export interface SessionData {
  shareId: string;
  driver: {
    displayName: string | null;
    // Add other driver fields if needed
  } | null;
  circuit: {
    venue: string | null;
    location: string | null;
    latitude: number | null;
    longitude: number | null;
    zoom: number | null;
    // Add other circuit fields if needed
  } | null;
  start: string | null;
  end: string | null;
  best: string | null;
  rolling: string | null;
  theorical: string | null;
  events: any[]; // Define more specific type if needed
  channels: string[];
  weather: {
    temperature: number | null;
    pressure: number | null;
    conditions: string | null;
    // Add other weather fields if needed
  } | null;
  video: string | null;
  sync: string | null;
  // Add any other top-level fields from the response
}

// Interface for channel data points
export interface ChannelDataPoint {
  s: number; // Time in seconds (y-axis)
  d: number; // Data value (x-axis)
}

const BASE_API_URL = 'https://lapviz.com/api/Session';

/**
 * Fetches session data from the API.
 * @param sessionId The session ID to fetch data for.
 * @returns A promise that resolves with the SessionData.
 * @throws An error if the fetch request fails or the response is not ok.
 */
export const fetchSessionData = async (sessionId: string): Promise<SessionData> => {
  const apiEndpoint = `${BASE_API_URL}/${sessionId}`;
  console.log(`Fetching session data from: ${apiEndpoint}`);
  
  const response = await fetch(apiEndpoint);
  
  if (!response.ok) {
    // Attempt to get error message from response body, otherwise use status text
    let errorBody = '';
    try {
        errorBody = await response.text();
    } catch {
        // Ignore error reading body
    }
    console.error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
    throw new Error(`HTTP error! status: ${response.status} - ${response.statusText || 'Failed to fetch'}`);
  }

  const data: SessionData = await response.json();
  return data;
};

/**
 * Fetches channel data for a specific lap.
 * @param sessionId The session ID to fetch data for.
 * @param lap The lap number.
 * @param channel The channel name.
 * @returns A promise that resolves with an array of channel data points.
 * @throws An error if the fetch request fails or the response is not ok.
 */
export const fetchLapChannelData = async (
  sessionId: string,
  lap: number,
  channel: string
): Promise<ChannelDataPoint[]> => {
  const apiEndpoint = `https://lapviz.com/api/Session/data/${sessionId}/${lap}/${channel}`;
  console.log(`Fetching channel data from: ${apiEndpoint}`);
  
  const response = await fetch(apiEndpoint);
  
  if (!response.ok) {
    let errorBody = '';
    try {
      errorBody = await response.text();
    } catch {
      // Ignore error reading body
    }
    console.error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
    throw new Error(`HTTP error! status: ${response.status} - ${response.statusText || 'Failed to fetch'}`);
  }

  const data: ChannelDataPoint[] = await response.json();
  return data;
}; 