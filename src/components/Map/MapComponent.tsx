import React, { useState, useEffect, useRef } from 'react';
import LoadingSpinner from '../common/LoadingSpinner';
import { fetchLapTrackPath, TrackPathPoint } from '../../api/sessionApi';

interface MapComponentProps {
  sessionId: string;
  selectedLap: number | null;
  circuitLocation?: { 
    lat: number | null; 
    lng: number | null;
    zoom?: number | null;
  };
}

// Speed data interface
interface SpeedDataPoint {
  s: number; // time/distance
  d: number; // speed value
}

// Module-level promise to ensure the API is loaded only once
let loadGoogleMapsAPIPromise: Promise<void> | null = null;

// Function to fetch speed data from the API
const fetchSpeedData = async (sessionId: string, lapNumber: number): Promise<SpeedDataPoint[]> => {
  try {
    const response = await fetch(`https://lapviz.com/api/Session/data/${sessionId}/${lapNumber}/GPS%20Speed`);
    if (!response.ok) {
      throw new Error(`Failed to fetch speed data: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching speed data:', error);
    throw error;
  }
};

// Function to load the Google Maps API script
const loadScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if script already exists
    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existingScript) {
      // If script exists, assume it's loading or loaded.
      // We rely on checking window.google.maps later or the promise resolving.
      // A more robust check might involve checking script 'readyState' or 'dataset' attributes
      // but for simplicity, we'll use the promise and window check.
      resolve(); // Resolve immediately if script tag exists, let the useEffect check window.google
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log("Google Maps API script loaded successfully.");
      resolve();
    };
    script.onerror = (error) => {
      console.error("Error loading Google Maps API script:", error);
      reject(new Error('Failed to load Google Maps API script.'));
    };
    document.head.appendChild(script);
  });
};

// Function to get the singleton promise for API loading
const getLoadGoogleMapsPromise = (): Promise<void> => {
  if (window.google?.maps) {
    // API already loaded
    return Promise.resolve();
  }

  if (!loadGoogleMapsAPIPromise) {
    loadGoogleMapsAPIPromise = loadScript();
  }

  return loadGoogleMapsAPIPromise;
};

const MapComponent: React.FC<MapComponentProps> = ({ sessionId, selectedLap, circuitLocation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [trackPath, setTrackPath] = useState<TrackPathPoint[]>([]);
  const [speedData, setSpeedData] = useState<SpeedDataPoint[]>([]);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const trackPathRef = useRef<google.maps.Polyline[] | null>(null);

  // Default location coordinates (will be overridden if circuit location is provided)
  const defaultLocation = { lat: 37.7749, lng: -122.4194 };
  const defaultZoom = 12;

  // Get the circuit location from props or use default
  const mapCenter = {
    lat: circuitLocation?.lat !== null && circuitLocation?.lat !== undefined ? circuitLocation.lat : defaultLocation.lat,
    lng: circuitLocation?.lng !== null && circuitLocation?.lng !== undefined ? circuitLocation.lng : defaultLocation.lng,
  } as google.maps.LatLngLiteral;
  const mapZoom = circuitLocation?.zoom || defaultZoom;

  // Function to initialize the map
  const initializeMap = () => {
    if (!window.google || !window.google.maps || !mapContainerRef.current) {
      console.error("Map initialization prerequisites not met");
      setHasError(true);
      setErrorMessage("Google Maps API not available");
      setIsLoading(false);
      return;
    }

    if (mapInstanceRef.current) {
      // Map already initialized, just update center if needed
      mapInstanceRef.current.setCenter(mapCenter);
      mapInstanceRef.current.setZoom(mapZoom);
      return;
    }

    try {
      console.log("Initializing map...");
      // Create a new map instance
      const mapOptions: google.maps.MapOptions = {
        center: mapCenter,
        zoom: mapZoom,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: false,
        rotateControl: false,
        scaleControl: false,
        panControl: false,
        disableDefaultUI: true,
        mapTypeId: google.maps.MapTypeId.SATELLITE,
        // Hide all map overlays, labels, and points of interest
        styles: [
          {
            featureType: "all",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
          },
          {
            featureType: "poi",
            stylers: [{ visibility: "off" }]
          },
          {
            featureType: "transit",
            stylers: [{ visibility: "off" }]
          },
          {
            featureType: "road",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
          },
          {
            featureType: "administrative",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
          },
          {
            featureType: "landscape",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
          }
        ]
      };

      const map = new window.google.maps.Map(
        mapContainerRef.current,
        mapOptions
      );

      // Save map instance for later reference
      mapInstanceRef.current = map;

      // Map loaded successfully
      setIsLoading(false);
      setHasError(false);
      console.log("Map initialized successfully.");
    } catch (error) {
      console.error('Error initializing map:', error);
      setHasError(true);
      setErrorMessage("Failed to initialize map");
      setIsLoading(false);
    }
  };

  // Function to convert speed to color (red to green gradient)
  const getColorForSpeed = (speed: number, minSpeed: number, maxSpeed: number): string => {
    // Normalize speed between 0 and 1
    const normalizedSpeed = Math.min(Math.max((speed - minSpeed) / (maxSpeed - minSpeed), 0), 1);
    
    // Convert to RGB values (red to green gradient)
    const r = Math.round(255 * (1 - normalizedSpeed));
    const g = Math.round(255 * normalizedSpeed);
    const b = 0;
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  // Function to render the track path on the map with color gradient based on speed
  const renderTrackPath = () => {
    if (!mapInstanceRef.current || trackPath.length === 0) {
      return;
    }

    // Clear any existing paths
    if (trackPathRef.current) {
      trackPathRef.current.forEach(polyline => polyline.setMap(null));
    }
    trackPathRef.current = [];

    // Create path coordinates from the track data
    const pathCoordinates = trackPath.map(point => ({
      lat: point.lat,
      lng: point.lng
    }));

    // If we have speed data, use it to color the path
    if (speedData.length > 0) {
      // Find min and max speed values
      const speeds = speedData.map(point => point.d);
      const minSpeed = Math.min(...speeds);
      const maxSpeed = Math.max(...speeds);

      // If we have fewer speed points than track points, we'll need to approximate
      // Here we'll assume speed points and track points roughly correspond by index
      // A more accurate approach would be to match by timestamp or distance
      
      // Create colored segments
      for (let i = 0; i < pathCoordinates.length - 1; i++) {
        // Get corresponding speed index, considering possible length difference
        const speedIndex = Math.min(i, speedData.length - 1);
        const speed = speedData[speedIndex].d;
        const color = getColorForSpeed(speed, minSpeed, maxSpeed);
        
        // Create a polyline segment with the appropriate color
        const segment = new window.google.maps.Polyline({
          path: [pathCoordinates[i], pathCoordinates[i + 1]],
          geodesic: true,
          strokeColor: color,
          strokeOpacity: 1.0,
          strokeWeight: 5,
          map: mapInstanceRef.current
        });
        
        trackPathRef.current.push(segment);
      }
    } else {
      // Fallback to single color if no speed data
      const trackPolyline = new window.google.maps.Polyline({
        path: pathCoordinates,
        geodesic: true,
        strokeColor: '#FF0000',
        strokeOpacity: 1.0,
        strokeWeight: 5,
        map: mapInstanceRef.current
      });
      
      trackPathRef.current = [trackPolyline];
    }

    // Fit the map bounds to show the entire track
    if (pathCoordinates.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      pathCoordinates.forEach(coord => {
        bounds.extend(coord);
      });
      mapInstanceRef.current.fitBounds(bounds);
    }
  };

  // Load Google Maps API and initialize map
  useEffect(() => {
    let isMounted = true;
    console.log("MapComponent useEffect triggered for map initialization.");

    getLoadGoogleMapsPromise()
      .then(() => {
        if (isMounted) {
          console.log("Google Maps API ready, attempting to initialize map.");
          initializeMap();
        }
      })
      .catch((error) => {
        console.error("Failed to load Google Maps API:", error);
        if (isMounted) {
          setHasError(true);
          setErrorMessage("Failed to load Google Maps API");
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [circuitLocation]); // Re-initialize when circuit location changes

  // Fetch track path data and speed data when sessionId or selectedLap changes
  useEffect(() => {
    let isMounted = true;
    console.log("MapComponent useEffect triggered for data fetching.");

    // Only fetch if we have a sessionId and selectedLap
    if (sessionId && selectedLap !== null) {
      setIsLoading(true);
      setHasError(false);

      // Fetch both track path and speed data
      Promise.all([
        fetchLapTrackPath(sessionId, selectedLap),
        fetchSpeedData(sessionId, selectedLap)
      ])
        .then(([pathData, speedPoints]) => {
          if (isMounted) {
            console.log(`Fetched ${pathData.length} track path points and ${speedPoints.length} speed points`);
            setTrackPath(pathData);
            setSpeedData(speedPoints);
            setIsLoading(false);

            // Call renderTrackPath after state update
            setTimeout(() => {
              if (isMounted) {
                renderTrackPath();
              }
            }, 0);
          }
        })
        .catch(error => {
          console.error("Error fetching data:", error);
          if (isMounted) {
            setHasError(true);
            setErrorMessage("Failed to fetch track data");
            setIsLoading(false);
          }
        });
    } else {
      // No session or lap selected
      if (trackPathRef.current) {
        trackPathRef.current.forEach(polyline => polyline.setMap(null));
        trackPathRef.current = null;
      }
      setTrackPath([]);
      setSpeedData([]);
    }

    return () => {
      isMounted = false;
    };
  }, [sessionId, selectedLap]);

  // Render track path when trackPath or speedData changes
  useEffect(() => {
    renderTrackPath();
  }, [trackPath, speedData]);

  // Function to retry loading the map
  const handleRetry = () => {
    console.log("Retrying map load...");
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');
    
    // Reset refs
    if (trackPathRef.current) {
      trackPathRef.current.forEach(polyline => polyline.setMap(null));
      trackPathRef.current = null;
    }
    mapInstanceRef.current = null;
    loadGoogleMapsAPIPromise = null;
    
    // Restart both processes
    getLoadGoogleMapsPromise()
      .then(() => {
        initializeMap();
        
        // If we have session and lap data, re-fetch data
        if (sessionId && selectedLap !== null) {
          return Promise.all([
            fetchLapTrackPath(sessionId, selectedLap),
            fetchSpeedData(sessionId, selectedLap)
          ]);
        }
        return Promise.resolve([[] as TrackPathPoint[], [] as SpeedDataPoint[]]);
      })
      .then((result) => {
        const [pathData, speedPoints] = result;
        if (Array.isArray(pathData)) setTrackPath(pathData as TrackPathPoint[]);
        if (Array.isArray(speedPoints)) setSpeedData(speedPoints as SpeedDataPoint[]);
        setIsLoading(false);
        
        // Render track path after everything is ready
        setTimeout(renderTrackPath, 0);
      })
      .catch(error => {
        console.error("Retry failed:", error);
        setHasError(true);
        setErrorMessage(error.message || "Failed to reload map");
        setIsLoading(false);
      });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800 mb-2 sm:mb-0">Track Map</h2>
        
        {!isLoading && trackPath.length > 0 && (
          <div className="text-sm text-gray-600">
            Showing lap {selectedLap} track path ({trackPath.length} points)
          </div>
        )}
      </div> */}
      
      <div 
        className="relative"
        style={{ paddingBottom: '56.25%' }}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded">
            <LoadingSpinner />
          </div>
        )}
        
        {hasError && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 rounded">
            <p className="text-red-500 font-medium mb-2">Failed to load map</p>
            <p className="text-sm text-gray-500 mb-4">{errorMessage || "Check console for details."}</p>
            <button 
              onClick={handleRetry}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Retry
            </button>
          </div>
        )}
        
        <div 
          ref={mapContainerRef}
          className={`absolute inset-0 w-full h-full rounded ${isLoading || hasError ? 'invisible' : ''}`}
        />
      </div>     
    </div>
  );
};

// Add the window augmentation for TypeScript (if not already global)
declare global {
  interface Window {
    google?: typeof google;
  }
}

export default MapComponent;