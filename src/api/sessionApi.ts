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

// Interface for track path data points
export interface TrackPathPoint {
  lat: number; // Latitude
  lng: number; // Longitude
  s: number;   // Time in seconds
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
  const apiEndpoint = `${BASE_API_URL}/data/${sessionId}/${lap}/${channel}`;
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

/**
 * Fetches track path data (lat/lng coordinates) for a specific lap.
 * @param sessionId The session ID to fetch data for.
 * @param lap The lap number.
 * @returns A promise that resolves with an array of track path points.
 * @throws An error if the fetch request fails or the response is not ok.
 */
export const fetchLapTrackPath = async (
  sessionId: string,
  lap: number
): Promise<TrackPathPoint[]> => {
  // We need to fetch both latitude and longitude channels
  const latitudeEndpoint = `${BASE_API_URL}/data/${sessionId}/${lap}/Latitude`;
  const longitudeEndpoint = `${BASE_API_URL}/data/${sessionId}/${lap}/Longitude`;
  console.log(`Fetching track path data from: ${latitudeEndpoint} and ${longitudeEndpoint}`);
  
  try {
    // Fetch both channels in parallel
    const [latResponse, lngResponse] = await Promise.all([
      fetch(latitudeEndpoint),
      fetch(longitudeEndpoint)
    ]);
    
    // Check if both responses are ok
    if (!latResponse.ok) {
      throw new Error(`HTTP error fetching latitude! status: ${latResponse.status}`);
    }
    if (!lngResponse.ok) {
      throw new Error(`HTTP error fetching longitude! status: ${lngResponse.status}`);
    }
    
    // Parse the JSON responses
    const latData: ChannelDataPoint[] = await latResponse.json();
    const lngData: ChannelDataPoint[] = await lngResponse.json();
    
    // Merge the data into track path points
    // This assumes both arrays have matching time points
    // A more robust implementation might interpolate missing points
    const trackPath: TrackPathPoint[] = [];
    
    // Use the shorter array length to avoid index out of bounds
    const minLength = Math.min(latData.length, lngData.length);
    
    for (let i = 0; i < minLength; i++) {
      // Make sure we have valid coordinate data
      if (latData[i] && lngData[i] && !isNaN(latData[i].d) && !isNaN(lngData[i].d)) {
        trackPath.push({
          lat: latData[i].d,
          lng: lngData[i].d,
          s: latData[i].s, // Use time from latitude data (should match longitude)
        });
      }
    }
    
    return trackPath;
  } catch (error) {
    console.error("Error fetching track path data:", error);
    throw error;
  }
}; 