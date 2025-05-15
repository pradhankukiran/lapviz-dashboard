import React, { useState, useEffect, useRef } from 'react';
import LoadingSpinner from '../common/LoadingSpinner';
import { useSyncContext } from '../../contexts/SyncContext'; // Import the context hook

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

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: any;
  }
}

interface VideoPlayerProps {
  videoUrl: string | null;
  seekToTime?: number | null;
  endTime?: number | null;
  shouldAutoplay?: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  videoUrl, 
  seekToTime, 
  endTime, 
  shouldAutoplay 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const playerRef = useRef<any>(null); 
  const iframeContainerRef = useRef<HTMLDivElement>(null);
  const [isApiLoaded, setIsApiLoaded] = useState(false);

  // Get context setters
  const { setVideoTime, setIsSyncActive } = useSyncContext();
  const playbackIntervalRef = useRef<number | null>(null); // Use number for interval ID

  // Effect to load YouTube Iframe API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setIsApiLoaded(true);
      return;
    }

    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      setIsApiLoaded(true);
    };

    return () => {
      delete window.onYouTubeIframeAPIReady;
    };
  }, []);
  
  // Effect to initialize and control the player
  useEffect(() => {
    console.log('VideoPlayer effect triggered. Props:', { videoUrl, seekToTime, endTime, shouldAutoplay, isApiLoaded });
    const currentVideoId = getYouTubeVideoId(videoUrl);
    setVideoId(currentVideoId);

    if (!currentVideoId) {
      setIsLoading(false);
      setHasError(!videoUrl); 
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      setIsSyncActive(false); // Ensure sync is off
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
      return;
    }
    
    setIsLoading(true);
    setHasError(false);

    const createPlayer = () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      if (!iframeContainerRef.current) {
          console.error("iframeContainerRef is null, cannot create player.");
          setIsLoading(false);
          setHasError(true);
          setIsSyncActive(false);
          return;
      }
      iframeContainerRef.current.innerHTML = ''; 
      const playerDiv = document.createElement('div');
      playerDiv.id = `youtube-player-${currentVideoId}-${Date.now()}`;
      playerDiv.style.width = '100%';
      playerDiv.style.height = '100%';
      iframeContainerRef.current.appendChild(playerDiv);

      console.log(`Creating player for videoId: ${currentVideoId}`);
      playerRef.current = new window.YT.Player(playerDiv.id, {
        videoId: currentVideoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: shouldAutoplay ? 1 : 0,
          controls: 1,
          rel: 0,
          showinfo: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          start: Math.floor(seekToTime || 0),
        },
        events: {
          onReady: (event: any) => {
            console.log('Player ready. seekToTime:', seekToTime, 'shouldAutoplay:', shouldAutoplay);
            setIsLoading(false);
            if (seekToTime && !shouldAutoplay) {
                 event.target.seekTo(Math.floor(seekToTime), true);
            }
          },
          onError: (event: any) => {
            console.error('YouTube Player Error:', event.data);
            setIsLoading(false);
            setHasError(true);
            setIsSyncActive(false); // Sync off on error
            if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
          },
          onStateChange: (event: any) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsSyncActive(true);
              if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
              playbackIntervalRef.current = setInterval(() => {
                if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
                  const currentTime = playerRef.current.getCurrentTime();
                  setVideoTime(currentTime);
                  // Check against endTime for pausing
                  if (endTime && currentTime >= endTime) {
                    console.log(`Reached end time (${endTime}), pausing video.`);
                    if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
                        playerRef.current.pauseVideo();
                    }
                    // PAUSED state will handle clearing interval and setIsSyncActive(false)
                  }
                }
              }, 50); // Update time every 50ms

            } else if (
              event.data === window.YT.PlayerState.PAUSED || 
              event.data === window.YT.PlayerState.ENDED
            ) {
              setIsSyncActive(false);
              if (playbackIntervalRef.current) {
                clearInterval(playbackIntervalRef.current);
                playbackIntervalRef.current = null;
              }
              // Update one last time on pause/end to ensure correct final state
              if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
                setVideoTime(playerRef.current.getCurrentTime());
              }
            }
          }
        }
      });
    };

    if (isApiLoaded && currentVideoId) {
      createPlayer();
    } else if (!isApiLoaded) {
      console.log("YouTube API not loaded yet.");
    }

    return () => {
      console.log("Cleaning up player effect");
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
      setIsSyncActive(false); // Ensure sync is off on unmount/cleanup
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.warn("Error destroying player:", e);
        }
        playerRef.current = null;
      }
    };
  }, [isApiLoaded, videoUrl, seekToTime, shouldAutoplay, endTime, setVideoTime, setIsSyncActive]);

  // The separate interval for endTime pausing is now integrated into the main playbackIntervalRef logic.
  // The playerRef.current.endTimeCheckInterval is no longer used or needed.

  const handleRetry = () => {
    setIsLoading(true);
    setHasError(false);
    const currentVideoId = getYouTubeVideoId(videoUrl);
    setVideoId(currentVideoId); 
    if (!isApiLoaded) {
        console.warn("Attempting retry but YouTube API not loaded yet.");
    }
  };
  
  const showLoading = isLoading && !!videoId && isApiLoaded;
  const showError = hasError || (!isLoading && !videoId && !!videoUrl);

  console.log('VideoPlayer render state:', { isLoading, hasError, videoId, showLoading, showError, seekToTime, endTime, shouldAutoplay, isApiLoaded });

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
            <p className="text-sm text-gray-500 mb-4">
              {(!videoId && !!videoUrl) ? "Invalid YouTube URL." : "Player error or no video URL."}
            </p>
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Retry
            </button>
          </div>
        )}
        
        <div 
            ref={iframeContainerRef} 
            className="absolute inset-0 w-full h-full rounded"
            style={{ display: (showLoading || showError || !videoId) ? 'none' : 'block' }}
        />

        {!videoUrl && !isLoading && !hasError && (
           <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 rounded">
            <p className="text-gray-500 font-medium">No video URL provided</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;