import React, { useState, useEffect, useRef } from 'react';
import LoadingSpinner from '../common/LoadingSpinner';

// Function to extract YouTube Video ID from various URL formats
const getYouTubeVideoId = (url: string | null | undefined): string | null => {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.substring(1);
    } else if (urlObj.hostname.includes('youtube.com')) {
      return urlObj.searchParams.get('v');
    }
  } catch (error) {
    console.error("Error parsing video URL:", error);
  }
  return null;
};

interface VideoPlayerProps {
  videoUrl: string | null;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    console.log('VideoPlayer received videoUrl:', videoUrl);
    setIsLoading(true);
    setHasError(false);
    const extractedId = getYouTubeVideoId(videoUrl);
    console.log('VideoPlayer extracted videoId:', extractedId);
    setVideoId(extractedId);
    
    // If no valid video ID could be extracted but a URL was provided, show error
    if (!extractedId && videoUrl) {
      setHasError(true);
      setIsLoading(false);
    }
    
    // If we have a valid videoId, automatically set a timeout to hide the loading spinner
    // This is a fallback in case the onLoad event doesn't fire properly
    if (extractedId) {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 3000); // 3 seconds timeout
      
      return () => clearTimeout(timer);
    }
  }, [videoUrl]);

  const handleIframeLoad = () => {
    console.log('VideoPlayer iframe loaded.');
    setIsLoading(false);
  };

  const handleIframeError = () => {
    console.error('VideoPlayer iframe error.');
    setIsLoading(false);
    setHasError(true);
  };

  const handleRetry = () => {
    setIsLoading(true);
    setHasError(false);
    const extractedId = getYouTubeVideoId(videoUrl);
    setVideoId(extractedId);
    if (!extractedId && videoUrl) {
      setHasError(true);
      setIsLoading(false);
    }
  };

  const showLoading = isLoading && !!videoId;
  const showError = hasError || (!isLoading && !videoId && !!videoUrl);
  const showPlayer = !isLoading && !showError && !!videoId;

  console.log('VideoPlayer render state:', { isLoading, hasError, videoId, showLoading, showError, showPlayer });

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="relative" style={{ paddingBottom: '56.25%' }}>
        {showLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded">
            <LoadingSpinner />
          </div>
        )}

        {showError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 rounded">
            <p className="text-red-500 font-medium mb-2">Failed to load video</p>
            <p className="text-sm text-gray-500 mb-4">Invalid URL or player error.</p>
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {videoId && (
          <iframe
            ref={iframeRef}
            className="absolute inset-0 w-full h-full rounded"
            src={`https://www.youtube.com/embed/${videoId}?rel=0&autoplay=1&mute=1`}
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        )}

        {/* Handle case where videoUrl is null/undefined from API */}
        {!videoUrl && !isLoading && (
           <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 rounded">
            <p className="text-gray-500 font-medium">No video URL provided</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;