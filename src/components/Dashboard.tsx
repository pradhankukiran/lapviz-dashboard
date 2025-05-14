import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import DataVisualization from './DataVisualization/DataVisualization';
import VideoPlayer from './VideoPlayer/VideoPlayer';
import MapComponent from './Map/MapComponent';
import LoadingSpinner from './common/LoadingSpinner';
import { useSessionData } from '../hooks/useSessionData';
import { SessionData } from '../api/sessionApi'; // Added for explicit typing

// Helper function to convert time format "HH:MM:SS.sss" to seconds
const convertSyncTimeToSeconds = (syncTime: string | null | undefined): number => {
  if (!syncTime) return 0;
  try {
    const timeParts = syncTime.split(':');
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    const secondsPart = timeParts[2].split('.');
    const seconds = parseInt(secondsPart[0], 10);
    const milliseconds = secondsPart[1] ? parseInt(secondsPart[1].substring(0, 3), 10) / 1000 : 0;
    return hours * 3600 + minutes * 60 + seconds + milliseconds;
  } catch (error) {
    console.error("Error parsing sync time:", error);
    return 0;
  }
};

// Helper function to get lap options
const getLapOptions = (events: SessionData['events'] | undefined): number[] => {
  if (!events) return [];
  const lapEvents = events.filter(event => event.type === 'lap');
  if (lapEvents.length === 0) return [];
  const maxLap = Math.max(...lapEvents.map(event => event.lap || 0));
  return Array.from({ length: maxLap }, (_, i) => i + 1);
};

// interface DashboardParams {
//   sessionId?: string;
// }
// Using inline type for useParams to avoid linter issues with complex types.

const Dashboard: React.FC = () => {
  // Use a type assertion for useParams
  const params = useParams<{ sessionId?: string }>(); // Changed to inline type
  const sessionId = params.sessionId || 'd372cc';
  const { data: sessionData, isLoading, error } = useSessionData(sessionId);

  // Derive channels, videoUrl, and lapOptions from the hook's data
  const channels = sessionData?.channels || [];
  const videoUrl = sessionData?.video || null;
  const lapOptions = getLapOptions(sessionData?.events);

  // Shared state for selected lap
  const [selectedLap, setSelectedLap] = useState<number | null>(null);
  const [videoSeekToTime, setVideoSeekToTime] = useState<number>(0);
  const [shouldAutoplayVideo, setShouldAutoplayVideo] = useState<boolean>(false);

  // Initialize selected lap when options are available
  useEffect(() => {
    if (lapOptions.length > 0 && selectedLap === null) {
      setSelectedLap(lapOptions[0]);
    }
  }, [lapOptions, selectedLap]);

  // Calculate video seek time and autoplay status based on selected lap and session data
  useEffect(() => {
    if (!sessionData) {
      setVideoSeekToTime(0);
      setShouldAutoplayVideo(false);
      return;
    }

    const baseSyncInSeconds = convertSyncTimeToSeconds(sessionData.sync);

    if (selectedLap === 1) {
      setVideoSeekToTime(baseSyncInSeconds);
      setShouldAutoplayVideo(false); // No autoplay for lap 1
    } else if (selectedLap && selectedLap > 1 && sessionData.events) {
      const currentLapEvent = sessionData.events.find(
        event => event.type === 'lap' && event.lap === selectedLap
      );
      if (currentLapEvent && typeof currentLapEvent.startSecond === 'number') {
        setVideoSeekToTime(baseSyncInSeconds + currentLapEvent.startSecond);
      } else {
        setVideoSeekToTime(baseSyncInSeconds);
      }
      setShouldAutoplayVideo(true); // Autoplay for laps > 1
    } else {
      setVideoSeekToTime(baseSyncInSeconds);
      setShouldAutoplayVideo(false); // Default to no autoplay
    }
  }, [selectedLap, sessionData]);

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
  console.log('Dashboard calculated videoSeekToTime:', videoSeekToTime);
  console.log('Dashboard shouldAutoplayVideo:', shouldAutoplayVideo);

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
              <VideoPlayer 
                videoUrl={videoUrl} 
                seekToTime={videoSeekToTime} 
                shouldAutoplay={shouldAutoplayVideo} 
              />
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