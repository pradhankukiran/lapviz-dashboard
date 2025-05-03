import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import DataVisualization from './DataVisualization/DataVisualization';
import VideoPlayer from './VideoPlayer/VideoPlayer';
import MapComponent from './Map/MapComponent';
import LoadingSpinner from './common/LoadingSpinner';
import { useSessionData } from '../hooks/useSessionData';

// Helper function to get lap options
const getLapOptions = (events: any[] | undefined): number[] => {
  if (!events) return [];
  const lapEvents = events.filter(event => event.type === 'lap');
  if (lapEvents.length === 0) return [];
  const maxLap = Math.max(...lapEvents.map(event => event.lap || 0));
  return Array.from({ length: maxLap }, (_, i) => i + 1);
};

interface DashboardParams {
  sessionId?: string;
}

const Dashboard: React.FC = () => {
  // Use a type assertion for useParams
  const params = useParams();
  const sessionId = params.sessionId || 'd372cc';
  const { data: sessionData, isLoading, error } = useSessionData(sessionId);

  // Derive channels, videoUrl, and lapOptions from the hook's data
  const channels = sessionData?.channels || [];
  const videoUrl = sessionData?.video || null;
  const lapOptions = getLapOptions(sessionData?.events);

  // Shared state for selected lap
  const [selectedLap, setSelectedLap] = useState<number | null>(null);

  // Initialize selected lap when options are available
  useEffect(() => {
    if (lapOptions.length > 0 && !selectedLap) {
      setSelectedLap(lapOptions[0]);
    }
  }, [lapOptions, selectedLap]);

  // Get circuit location from session data
  const circuitLocation = sessionData?.circuit ? {
    lat: sessionData.circuit.latitude,
    lng: sessionData.circuit.longitude,
    zoom: sessionData.circuit.zoom
  } : undefined;

  console.log('Dashboard for session:', sessionId);
  console.log('Dashboard passing videoUrl:', videoUrl);
  console.log('Dashboard calculated lapOptions:', lapOptions);
  console.log('Dashboard selected lap:', selectedLap);

  return (
    <div className="container mx-auto px-4 py-8">
      

      {isLoading && (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline"> Failed to load dashboard data. {error}</span>
        </div>
      )}

      {!isLoading && !error && sessionData && (
        <div className="space-y-8">
          <div className="w-full">
            <DataVisualization 
              channels={channels} 
              lapOptions={lapOptions} 
              sessionId={sessionId}
              selectedLap={selectedLap}
              onLapChange={setSelectedLap}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="w-full">
              <VideoPlayer videoUrl={videoUrl} />
            </div>
            <div className="w-full">
              <MapComponent 
                sessionId={sessionId}
                selectedLap={selectedLap}
                circuitLocation={circuitLocation}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;