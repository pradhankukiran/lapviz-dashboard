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
  seekToTime?: number | null;
  shouldAutoplay?: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl, seekToTime, shouldAutoplay }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    console.log('VideoPlayer received videoUrl:', videoUrl);
    console.log('VideoPlayer received seekToTime:', seekToTime);
    console.log('VideoPlayer received shouldAutoplay:', shouldAutoplay);
    setIsLoading(true);
    setHasError(false);
    
    const extractedId = getYouTubeVideoId(videoUrl);
    console.log('VideoPlayer extracted videoId:', extractedId);
    setVideoId(extractedId);
    
    // Set startTime directly from seekToTime prop, defaulting to 0
    const newStartTime = seekToTime || 0;
    setStartTime(newStartTime);
    console.log('VideoPlayer set start time (seconds):', newStartTime);
    
    if (!extractedId && videoUrl) {
      setHasError(true);
      setIsLoading(false);
      return; // Early exit if no ID but URL was provided
    }
    
    if (extractedId) {
      // If iframeRef.current exists, it means the iframe might already be in the DOM.
      // Changing the key will force a re-render. If not, onLoad will handle setIsLoading.
      // The timeout is a fallback.
      const timer = setTimeout(() => {
        // Check if still loading after timeout AND iframe is potentially loaded
        if (isLoading && iframeRef.current?.contentWindow) {
          setIsLoading(false); 
        }
      }, 5000); // Increased timeout slightly for safety
      
      return () => clearTimeout(timer);
    } else if (!videoUrl) {
        setIsLoading(false); // If no videoUrl at all, stop loading.
    }
    // If no extractedId and no videoUrl, isLoading will remain true until one is provided or error is set.

  }, [videoUrl, seekToTime]);

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
    // videoUrl and seekToTime are from props, useEffect will re-evaluate them.
    // Explicitly re-extracting ID here is fine, or let useEffect do it.
    const extractedId = getYouTubeVideoId(videoUrl);
    setVideoId(extractedId);
    // startTime is set by the useEffect listening to seekToTime
    if (!extractedId && videoUrl) {
      setHasError(true);
      setIsLoading(false);
    }
  };

  // Determine visibility states
  // Show loading if isLoading is true AND we have a videoId (meaning we are attempting to load that specific video)
  const showLoading = isLoading && !!videoId;
  // Show error if hasError flag is true, OR if we are not loading, don't have a videoId, but a videoUrl was provided (implies extraction failed)
  const showError = hasError || (!isLoading && !videoId && !!videoUrl);

  console.log('VideoPlayer render state:', { isLoading, hasError, videoId, showLoading, showError, startTime, shouldAutoplay });

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

        {videoId && !showError && (
          <iframe
            key={`${videoId}-${startTime}-${shouldAutoplay}`}
            ref={iframeRef}
            className="absolute inset-0 w-full h-full rounded"
            src={`https://www.youtube.com/embed/${videoId}?rel=0&autoplay=${shouldAutoplay ? 1 : 0}&mute=0&controls=1&showinfo=0&modestbranding=1&iv_load_policy=3&disablekb=1&start=${Math.floor(startTime)}`}
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