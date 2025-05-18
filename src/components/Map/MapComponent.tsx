import React, { useState, useEffect, useRef } from 'react';
import LoadingSpinner from '../common/LoadingSpinner';
import { fetchLapTrackPath, TrackPathPoint } from '../../api/sessionApi';
import { CHART_HOVER_EVENT } from '../DataVisualization/ChartComponent';
import { useSyncContext } from '../../contexts/SyncContext';

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

// Function to get or create the promise
const getLoadGoogleMapsPromise = () => {
  if (!loadGoogleMapsAPIPromise) {
    loadGoogleMapsAPIPromise = loadScript();
  }
  return loadGoogleMapsAPIPromise;
};

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

const MapComponent: React.FC<MapComponentProps> = ({ sessionId, selectedLap, circuitLocation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [trackPath, setTrackPath] = useState<TrackPathPoint[]>([]);
  const [speedData, setSpeedData] = useState<SpeedDataPoint[]>([]);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const trackPathRef = useRef<google.maps.Polyline[] | null>(null);
  const hoverMarkerRef = useRef<google.maps.Marker | null>(null);
  
  // Consume SyncContext
  const { graphTime: syncedGraphTime, isSyncActive } = useSyncContext();

  // Local hoverTime state, can be driven by chart hover OR video sync
  const [mapHoverTime, setMapHoverTime] = useState<number | null>(null);
  const lastValidMapHoverTimeRef = useRef<number | null>(null);
  const hasFitBoundsForCurrentLapRef = useRef<boolean>(false);

  // New state to track if map is ready for drawing operations
  const [isMapReadyForDrawing, setIsMapReadyForDrawing] = useState<boolean>(false);

  // Default location coordinates (will be overridden if circuit location is provided)
  const defaultLocation = { lat: 37.7749, lng: -122.4194 };
  const defaultZoom = 12;

  // Get the circuit location from props or use default
  const mapCenter = {
    lat: circuitLocation?.lat !== null && circuitLocation?.lat !== undefined ? circuitLocation.lat : defaultLocation.lat,
    lng: circuitLocation?.lng !== null && circuitLocation?.lng !== undefined ? circuitLocation.lng : defaultLocation.lng,
  } as google.maps.LatLngLiteral;
  const mapZoom = circuitLocation?.zoom || defaultZoom;

  // Listen for chart hover events (manual hover on chart)
  useEffect(() => {
    const handleChartHover = (event: Event) => {
      const customEvent = event as CustomEvent;
      const timeFromChart = customEvent.detail?.time;
      console.log("Map: Chart hover event received (manual):", timeFromChart);
      setMapHoverTime(timeFromChart); // Update map's hover time based on chart
    };

    console.log("Map: Adding chart hover event listener");
    document.addEventListener(CHART_HOVER_EVENT, handleChartHover);
    
    // Initialize with first point if available and not in sync mode
    if (!isSyncActive && trackPath.length > 0 && !mapHoverTime && !lastValidMapHoverTimeRef.current) {
      console.log("Map: Setting initial hover time from event listener (not synced)");
      const firstPoint = trackPath[0];
      setMapHoverTime(firstPoint.s);
      lastValidMapHoverTimeRef.current = firstPoint.s;
    }
    
    return () => {
      console.log("Map: Removing chart hover event listener");
      document.removeEventListener(CHART_HOVER_EVENT, handleChartHover);
    };
  }, [trackPath, isSyncActive]);

  // Effect to update mapHoverTime based on video sync
  useEffect(() => {
    if (isSyncActive && syncedGraphTime !== null) {
      console.log("Map: Sync active, updating mapHoverTime from syncedGraphTime:", syncedGraphTime);
      setMapHoverTime(syncedGraphTime);
    } 
    // If sync becomes inactive, mapHoverTime will be controlled by the CHART_HOVER_EVENT listener
    // or remain at its last synced value until a chart hover occurs.
  }, [isSyncActive, syncedGraphTime]);

  // Update marker position when mapHoverTime changes
  useEffect(() => {
    if (isMapReadyForDrawing) { // Only update marker if map is ready
        updateHoverMarker(mapHoverTime);
    }
  }, [mapHoverTime, trackPath, isMapReadyForDrawing]); // Added isMapReadyForDrawing

  // Function to find the track point closest to the given time
  const findTrackPointByTime = (time: number): TrackPathPoint | null => {
    if (!trackPath.length || time === null) return null;
    
    // Find the closest point by time
    let closestPoint = trackPath[0];
    let closestDistance = Math.abs(trackPath[0].s - time);
    
    for (const point of trackPath) {
      const distance = Math.abs(point.s - time);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPoint = point;
      }
    }
    
    return closestPoint;
  };

  // Function to create or update the hover marker
  const updateHoverMarker = (currentTimeForMarker: number | null) => {
    console.log("Map: updateHoverMarker called, currentTimeForMarker:", currentTimeForMarker, "lastValidTime:", lastValidMapHoverTimeRef.current);
    
    if (!mapInstanceRef.current) {
      console.log("Map: Map not ready, can't create marker");
      if (hoverMarkerRef.current) {
        hoverMarkerRef.current.setMap(null);
        hoverMarkerRef.current = null;
      }
      return;
    }
    
    // Use the provided currentTimeForMarker, or fallback to last known valid time if current is null
    const effectiveTime = currentTimeForMarker ?? lastValidMapHoverTimeRef.current;
    
    if (effectiveTime === null) { // Changed from !effectiveTime to explicit null check
      console.log("Map: No effective hover time available for marker.");
      // Optionally hide marker if no time is available, or leave it at last position
      // if (hoverMarkerRef.current) { hoverMarkerRef.current.setVisible(false); }
      return;
    }
    
    const point = findTrackPointByTime(effectiveTime);
    
    if (!point) {
      console.log("Map: No matching track point found for time:", effectiveTime);
      // Optionally hide marker if no point found
      // if (hoverMarkerRef.current) { hoverMarkerRef.current.setVisible(false); }
      return;
    }

    // If we have a valid point based on a non-null currentTimeForMarker, update last valid ref
    if (currentTimeForMarker !== null) {
      lastValidMapHoverTimeRef.current = currentTimeForMarker;
    }
    
    console.log("Map: Creating/updating marker at track point:", point);
    const position = { lat: point.lat, lng: point.lng };
    
    if (!hoverMarkerRef.current) {
      console.log("Map: Creating new marker");
      hoverMarkerRef.current = new google.maps.Marker({
        position,
        map: mapInstanceRef.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#4285F4',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2
        },
        zIndex: 1000
      });
    } else {
      console.log("Map: Updating existing marker");
      hoverMarkerRef.current.setPosition(position);
      // if (!hoverMarkerRef.current.getVisible()) { hoverMarkerRef.current.setVisible(true); }
    }
  };

  // Function to initialize the map
  const initializeMap = () => {
    if (!window.google || !window.google.maps || !mapContainerRef.current) {
      console.error("Map initialization prerequisites not met");
      setHasError(true);
      setErrorMessage("Google Maps API not available");
      setIsLoading(false);
      setIsMapReadyForDrawing(false); // Ensure it's false if pre-reqs fail
      return;
    }

    if (mapInstanceRef.current) {
      console.log("Map already initialized. Setting center/zoom.");
      mapInstanceRef.current.setCenter(mapCenter);
      mapInstanceRef.current.setZoom(mapZoom);
      setIsMapReadyForDrawing(true); // Map instance exists, so it's ready for drawing
      
      // If track data and marker also need re-init on existing map (e.g. after retry with data)
      if (trackPath.length > 0 && !hoverMarkerRef.current && isMapReadyForDrawing) {
          // This logic is similar to the special marker init effect, consider consolidating
          // or ensure this initializes marker correctly if map was ready before data.
          console.log("MAP RE-INIT (existing map): Forcing marker update");
          const firstPoint = trackPath[0];
          if (firstPoint) {
            const initialTime = isSyncActive && syncedGraphTime !== null ? syncedGraphTime : firstPoint.s;
            setMapHoverTime(initialTime);
            lastValidMapHoverTimeRef.current = initialTime;
            setTimeout(() => updateHoverMarker(initialTime), 0);
          }
      }
      return;
    }

    try {
      console.log("Initializing new map instance...");
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
      
      // Add an idle event listener to know when the map is fully loaded
      map.addListener('idle', () => {
        console.log("MAP IDLE EVENT: Map is fully loaded and idle. Setting isMapReadyForDrawing to true.");
        setIsMapReadyForDrawing(true);
        // Now that map is idle and ready, if track data is present, render it and init marker
        if (trackPath.length > 0) {
            console.log("MAP IDLE: Track data present, attempting to render path and marker.");
            renderTrackPath(true); // Fit bounds as map is newly ready
            // Marker initialization will be handled by its dedicated effect reacting to isMapReadyForDrawing & mapHoverTime
        }
      });

      // Save map instance for later reference
      mapInstanceRef.current = map;

      // Map loaded successfully
      setIsLoading(false);
      setHasError(false);
      console.log("New map instance initialized. Waiting for idle state or data to be fully ready for drawing.");
      
      // If we have track data, try to initialize marker
      if (trackPath.length > 0) {
        console.log("MAP INIT: New map created, forcing marker update");
        const firstPoint = trackPath[0];
        if (firstPoint) {
          const initialTime = isSyncActive && syncedGraphTime !== null ? syncedGraphTime : firstPoint.s;
          setMapHoverTime(initialTime);
          lastValidMapHoverTimeRef.current = initialTime;
          setTimeout(() => updateHoverMarker(initialTime), 0);
        }
      }
    } catch (error) {
      console.error('Error initializing map:', error);
      setHasError(true);
      setErrorMessage("Failed to initialize map");
      setIsLoading(false);
      setIsMapReadyForDrawing(false);
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
  const renderTrackPath = (shouldFitBounds: boolean) => {
    if (!mapInstanceRef.current || !isMapReadyForDrawing || trackPath.length === 0) { // Check isMapReadyForDrawing
      console.log("RenderTrackPath: Conditions not met (map instance, map ready, or track path)", 
                  { mapInstance: !!mapInstanceRef.current, isMapReady: isMapReadyForDrawing, hasTrackPath: trackPath.length > 0 });
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

    // Fit the map bounds ONLY if requested (e.g., on new lap load)
    if (shouldFitBounds && pathCoordinates.length > 0 && mapInstanceRef.current) {
      const bounds = new window.google.maps.LatLngBounds();
      pathCoordinates.forEach(coord => {
        bounds.extend(coord);
      });
      mapInstanceRef.current.fitBounds(bounds);
      hasFitBoundsForCurrentLapRef.current = true; // Mark that we've fit bounds for this track
      console.log("RenderTrackPath: FitBounds completed.");
    }
  };

  // Load Google Maps API and initialize map
  useEffect(() => {
    let isMounted = true;
    console.log("MapComponent useEffect triggered for map API load and initialization.");
    setIsMapReadyForDrawing(false); // Reset on circuit location change before attempting init
    getLoadGoogleMapsPromise()
      .then(() => { if (isMounted) initializeMap(); })
      .catch((error) => {
        console.error("Failed to load Google Maps API:", error);
        if (isMounted) {
          setHasError(true);
          setErrorMessage("Failed to load Google Maps API");
          setIsLoading(false);
          setIsMapReadyForDrawing(false);
        }
      });
    return () => { isMounted = false; };
  }, [circuitLocation]); // circuitLocation is memoized in Dashboard

  // Fetch track path data and speed data
  useEffect(() => {
    let isMounted = true;
    if (sessionId && selectedLap !== null) {
      setIsLoading(true);
      setHasError(false);
      hasFitBoundsForCurrentLapRef.current = false;
      // Do not set isMapReadyForDrawing here, it's tied to map API/instance lifecycle

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
            // Initial mapHoverTime setting remains, but drawing waits for map readiness
            if (pathData.length > 0) {
              const firstPointTime = pathData[0].s;
              if (!isSyncActive && mapHoverTime === null) setMapHoverTime(firstPointTime);
              else if (isSyncActive && syncedGraphTime !== null) setMapHoverTime(syncedGraphTime);
              else if (mapHoverTime === null) setMapHoverTime(firstPointTime);
              if (mapHoverTime !== null) lastValidMapHoverTimeRef.current = mapHoverTime; 
            }
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
      
      // Clear hover marker
      if (hoverMarkerRef.current) {
        hoverMarkerRef.current.setMap(null);
        hoverMarkerRef.current = null;
      }
      
      setTrackPath([]);
      setSpeedData([]);
      hasFitBoundsForCurrentLapRef.current = false;
      // isMapReadyForDrawing should not be reset here, map might still be ready for a future lap
    }
    return () => { isMounted = false; };
  }, [sessionId, selectedLap]);

  // Effect to render track and fit bounds when trackPath/speedData changes AND map is ready
  useEffect(() => {
    if (trackPath.length > 0 && isMapReadyForDrawing && mapInstanceRef.current) {
        console.log("Map: Track data available and map is ready. Calling renderTrackPath with fitBounds.");
        renderTrackPath(true); // Fit bounds when new track/speed data is set AND map is ready
    } else if (trackPath.length === 0 && isMapReadyForDrawing && trackPathRef.current) {
        // Clear existing polylines if trackPath is empty but map was ready
        trackPathRef.current.forEach(polyline => polyline.setMap(null));
        trackPathRef.current = [];
    }
  }, [trackPath, speedData, isMapReadyForDrawing]); // Depends on data & map readiness

  // Effect to initialize or update marker based on hover time changes AND map readiness
  useEffect(() => {
    if (trackPath.length > 0 && isMapReadyForDrawing) { // Check map readiness
      let targetMarkerTime: number | null = null;
      if (isSyncActive && syncedGraphTime !== null) targetMarkerTime = syncedGraphTime;
      else if (mapHoverTime !== null) targetMarkerTime = mapHoverTime;
      else targetMarkerTime = trackPath[0].s; // Fallback

      if (targetMarkerTime !== null) {
        lastValidMapHoverTimeRef.current = targetMarkerTime;
        updateHoverMarker(targetMarkerTime);
      } else {
        updateHoverMarker(null);
      }
    }
  }, [mapHoverTime, trackPath, isMapReadyForDrawing, isSyncActive, syncedGraphTime]);

  // Special marker init effect (creates the marker instance if it doesn't exist)
  useEffect(() => {
    if (trackPath.length > 0 && isMapReadyForDrawing && mapInstanceRef.current && !hoverMarkerRef.current) {
      console.log("Map: Special marker init effect - Map ready, track data present, marker does not exist.");
      let timeToInitMarker: number | null = null;
      if (isSyncActive && syncedGraphTime !== null) timeToInitMarker = syncedGraphTime;
      else if (mapHoverTime !== null) timeToInitMarker = mapHoverTime;
      else if (trackPath.length > 0) timeToInitMarker = trackPath[0].s;

      if (timeToInitMarker !== null) {
        const point = findTrackPointByTime(timeToInitMarker);
        if (point) {
          console.log("Map: Special init - Creating marker for time:", timeToInitMarker);
          setMapHoverTime(timeToInitMarker); // Ensure mapHoverTime is consistent
          lastValidMapHoverTimeRef.current = timeToInitMarker;
          hoverMarkerRef.current = new google.maps.Marker({
            position: { lat: point.lat, lng: point.lng },
            map: mapInstanceRef.current,
            icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#4285F4', fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 2 },
            zIndex: 1000
          });
        } else {
            console.warn("Map: Special init - Could not find track point for time:", timeToInitMarker);
        }
      }
    }
  }, [trackPath, isMapReadyForDrawing, mapInstanceRef.current, isSyncActive, syncedGraphTime, mapHoverTime]);

  // Function to retry loading the map
  const handleRetry = () => {
    console.log("Retrying map load...");
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');
    setIsMapReadyForDrawing(false); // Reset map readiness
    // Reset refs
    if (trackPathRef.current) {
      trackPathRef.current.forEach(polyline => polyline.setMap(null));
      trackPathRef.current = null;
    }
    
    if (hoverMarkerRef.current) {
      hoverMarkerRef.current.setMap(null);
      hoverMarkerRef.current = null;
    }
    
    mapInstanceRef.current = null;
    loadGoogleMapsAPIPromise = null;
    
    getLoadGoogleMapsPromise().then(() => {
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
          className={`absolute inset-0 w-full h-full rounded ${isLoading || hasError || !isMapReadyForDrawing ? 'invisible' : ''}`}
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