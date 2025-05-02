import React, { useState, useEffect, useRef } from 'react';
import LoadingSpinner from '../common/LoadingSpinner';

// Module-level promise to ensure the API is loaded only once
let loadGoogleMapsAPIPromise: Promise<void> | null = null;

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

const MapComponent: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null); // Use google.maps.Map type

  // Default location coordinates (San Francisco)
  const defaultLocation = { lat: 37.7749, lng: -122.4194 };
  const defaultZoom = 12;

  // Function to initialize the map (now separate)
  const initializeMap = () => {
    if (window.google && window.google.maps && mapContainerRef.current && !mapInstanceRef.current) { // Ensure map isn't already initialized
      try {
        console.log("Initializing map...");
        // Create a new map instance
        const mapOptions: google.maps.MapOptions = { // Use google.maps.MapOptions type
          center: defaultLocation,
          zoom: defaultZoom,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
          zoomControl: true,
        };

        const map = new window.google.maps.Map(
          mapContainerRef.current,
          mapOptions
        );

        // Add a marker for the default location
        new window.google.maps.Marker({ // Use google.maps.Marker type
          position: defaultLocation,
          map: map,
          title: 'Default Location',
        });

        // Save map instance for later reference
        mapInstanceRef.current = map;

        // Map loaded successfully
        setIsLoading(false);
        setHasError(false); // Reset error state on success
        console.log("Map initialized successfully.");
      } catch (error) {
        console.error('Error initializing map:', error);
        setHasError(true);
        setIsLoading(false);
      }
    } else if (mapInstanceRef.current) {
        console.log("Map already initialized.");
        setIsLoading(false); // Already initialized, stop loading indicator
        setHasError(false);
    } else {
        console.error("Map initialization prerequisites not met:", {
            hasWindowGoogle: !!window.google,
            hasGoogleMaps: !!window.google?.maps,
            hasMapContainer: !!mapContainerRef.current,
            hasMapInstance: !!mapInstanceRef.current
        });
        setHasError(true); // Indicate an error if prerequisites aren't met
        setIsLoading(false);
    }
  };


  useEffect(() => {
    let isMounted = true; // Track mount status for async operations

    console.log("MapComponent useEffect triggered.");

    getLoadGoogleMapsPromise()
      .then(() => {
        if (isMounted) {
          console.log("Google Maps API ready, attempting to initialize map.");
          initializeMap();
        } else {
            console.log("Component unmounted before API promise resolved.");
        }
      })
      .catch((error) => {
        console.error("Failed to load Google Maps API:", error);
        if (isMounted) {
          setHasError(true);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
      console.log("MapComponent unmounting.");
      // Optional: Clean up map instance if needed, though usually not necessary
      // if the component is just unmounting temporarily (e.g., HMR)
      // if (mapInstanceRef.current) {
      //   // Perform any cleanup specific to the map instance if required
      // }
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  // Function to retry loading the map
  const handleRetry = () => {
    console.log("Retrying map load...");
    setIsLoading(true);
    setHasError(false);
    mapInstanceRef.current = null; // Reset map instance ref
    loadGoogleMapsAPIPromise = null; // Reset the promise to allow reloading the script if it failed

    // Re-run the effect's logic
    getLoadGoogleMapsPromise()
      .then(() => {
          console.log("Retry: Google Maps API ready, attempting to initialize map.");
          initializeMap();
      })
      .catch((error) => {
        console.error("Retry failed: Failed to load Google Maps API:", error);
        setHasError(true);
        setIsLoading(false);
      });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      
      
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
            <p className="text-sm text-gray-500 mb-4">Check console for API key or loading errors.</p>
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
// It's generally better to put this in a dedicated .d.ts file (e.g., vite-env.d.ts or global.d.ts)
// but keep it here for self-contained example.
declare global {
  interface Window {
    google?: typeof google; // Use optional chaining for safety
    // No longer need googleMapsCallback here
  }
}

export default MapComponent;