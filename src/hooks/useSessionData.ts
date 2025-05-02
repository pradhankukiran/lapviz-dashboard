import { useState, useEffect } from 'react';
import { fetchSessionData, SessionData } from '../api/sessionApi';

interface UseSessionDataReturn {
  data: SessionData | null;
  isLoading: boolean;
  error: string | null;
}

export const useSessionData = (sessionId: string): UseSessionDataReturn => {
  const [data, setData] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true; // Prevent state updates on unmounted component

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchSessionData(sessionId);
        if (isMounted) {
          setData(result);
        }
      } catch (e) {
        console.error("Failed to fetch session data in hook:", e);
        if (isMounted) {
          setError(e instanceof Error ? e.message : 'An unknown error occurred');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [sessionId]); // Now depends on sessionId, so it will refetch when the ID changes

  return { data, isLoading, error };
}; 