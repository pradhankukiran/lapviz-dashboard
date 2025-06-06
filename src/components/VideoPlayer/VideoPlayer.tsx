import React, { useState, useEffect, useRef, useCallback } from 'react';
import LoadingSpinner from '../common/LoadingSpinner';
import { useSyncContext } from '../../contexts/SyncContext'; // Import the context hook
import { CHART_HOVER_EVENT } from '../DataVisualization/ChartComponent'; // Import event name

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

// Debounce utility function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
//   let timeoutId: ReturnType<typeof setTimeout> | null = null;

//   return (...args: Parameters<F>): Promise<ReturnType<F>> =>
//     new Promise((resolve) => {
//       if (timeoutId) {
//         clearTimeout(timeoutId);
//       }
//       timeoutId = setTimeout(() => {
//         timeoutId = null;
//         resolve(func(...args));
//       }, waitFor);
//     });
// }

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
  const playerManuallySeekedRef = useRef<boolean>(false);

  // Get context setters
  const { videoTime, setVideoTime, setIsSyncActive, lapStartVideoTime, isSyncActive } = useSyncContext();
  const videoTimeRef = useRef(videoTime); // Ref to hold current videoTime for logging in useCallback

  useEffect(() => {
    videoTimeRef.current = videoTime; // Keep the ref updated when videoTime from context changes
  }, [videoTime]);

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
  
  // Debounced seek function
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // const debouncedSeek = useCallback(
  //   debounce((time: number) => {
  //     if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
  //       // LOGGING START
  //       console.log(`[VideoPlayer debouncedSeek] Seeking YouTube player to: ${time}. Current videoTime in context (via ref): ${videoTimeRef.current}. playerManuallySeekedRef will be set to true.`);
  //       // LOGGING END
  //       playerRef.current.seekTo(time, true);
  //       setVideoTime(time); // Update context videoTime
  //       playerManuallySeekedRef.current = true; // Set the flag indicating a manual seek
  //     }
  //   }, 300), 
  //   [setVideoTime] 
  // );

  // Effect to handle graph hover events for seeking video
  useEffect(() => {
    const handleGraphHover = (event: Event) => {
      const customEvent = event as CustomEvent;
      const graphHoverTime = customEvent.detail?.time; // This is lap-relative time
      const userInitiated = customEvent.detail?.userInitiated; // Get the new flag

      // LOGGING START
      console.log('[VideoPlayer GraphHoverListener] Received CHART_HOVER_EVENT.', {
        isSyncActive, // VideoPlayer's perspective of isSyncActive (before potential change)
        lapStartVideoTime,
        graphHoverTimeFromEvent: graphHoverTime,
        userInitiated // Log the flag
      });
      // LOGGING END

      // MODIFICATION: Only process for seek/pause if userInitiated is true
      if (!userInitiated) {
        console.log('[VideoPlayer GraphHoverListener] Event not user-initiated, ignoring for seek/pause.');
        return;
      }

      if (graphHoverTime !== null && typeof graphHoverTime === 'number') {
        const absoluteVideoSeekTime = lapStartVideoTime + graphHoverTime;

        if (playerRef.current && 
            typeof playerRef.current.seekTo === 'function' && 
            typeof playerRef.current.pauseVideo === 'function' &&
            typeof playerRef.current.playVideo === 'function' // Ensure playVideo exists
        ) {
          const videoWasPlaying = isSyncActive; // Capture state before action

          console.log(`[VideoPlayer GraphHoverListener] User hover. Seeking video to: ${absoluteVideoSeekTime}. Video was playing: ${videoWasPlaying}`);
          
          playerRef.current.seekTo(absoluteVideoSeekTime, true);
          setVideoTime(absoluteVideoSeekTime); // Update context with the new time
          playerManuallySeekedRef.current = true; // Indicate a manual seek action

          if (videoWasPlaying) {
            console.log('[VideoPlayer GraphHoverListener] Video was playing, attempting to resume play.');
            playerRef.current.playVideo();
            // setIsSyncActive(true); // onStateChange will handle this
          } else {
            console.log('[VideoPlayer GraphHoverListener] Video was paused, ensuring it remains paused.');
            playerRef.current.pauseVideo(); 
            // setIsSyncActive(false); // onStateChange will handle this
          }
        } else {
          console.log(`[VideoPlayer GraphHoverListener] Player not ready for seek/play/pause. graphHoverTime: ${graphHoverTime}`);
        }
      } else {
         console.log(`[VideoPlayer GraphHoverListener] Conditions NOT MET (event time invalid). graphHoverTime: ${graphHoverTime}`);
      }
    };

    console.log("VideoPlayer: Adding graph hover event listener");
    document.addEventListener(CHART_HOVER_EVENT, handleGraphHover);

    return () => {
      console.log("VideoPlayer: Removing graph hover event listener");
      document.removeEventListener(CHART_HOVER_EVENT, handleGraphHover);
    };
  }, [isSyncActive, lapStartVideoTime, setVideoTime, setIsSyncActive]); // isSyncActive is still relevant for logging initial state

  // Effect to initialize and control the player
  useEffect(() => {
    console.log('VideoPlayer effect triggered. Props:', { videoUrl, seekToTime, endTime, shouldAutoplay, isApiLoaded });
    const currentVideoId = getYouTubeVideoId(videoUrl);

    // If videoUrl changes, it implies a new video, so reset the manual seek flag.
    if (videoId !== currentVideoId) {
      console.log('Video ID changed, resetting playerManuallySeekedRef');
      playerManuallySeekedRef.current = false;
    }
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
              if (!playerManuallySeekedRef.current) {
                console.log('Player ready: seeking to prop seekToTime:', seekToTime);
                event.target.seekTo(Math.floor(seekToTime), true);
              } else {
                console.log('Player ready: manual seek detected, not seeking to prop seekToTime');
              }
            }
            // Always reset the flag after onReady has processed it, for the current player instance.
            // This ensures that if the same player instance has its onReady triggered again (unlikely but possible),
            // it would behave normally unless another manual seek happens before that hypothetical second onReady.
            playerManuallySeekedRef.current = false; 
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

                  // Always update videoTime with the player's current time when playing.
                  setVideoTime(currentTime);

                  // If a manual seek was flagged (by graph hover),
                  // clear the flag now that we are in a playing state and syncing time.
                  if (playerManuallySeekedRef.current) {
                    playerManuallySeekedRef.current = false;
                  }

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