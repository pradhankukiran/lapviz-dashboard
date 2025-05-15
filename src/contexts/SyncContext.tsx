import React,
{ createContext, useState, useContext, ReactNode } from 'react';

interface SyncContextType {
  videoTime: number;
  setVideoTime: (time: number) => void;
  lapStartVideoTime: number;
  setLapStartVideoTime: (time: number) => void;
  isSyncActive: boolean;
  setIsSyncActive: (isActive: boolean) => void;
  // Derived value: time on the graph's x-axis relative to lap start
  graphTime: number | null;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [videoTime, setVideoTime] = useState<number>(0);
  const [lapStartVideoTime, setLapStartVideoTime] = useState<number>(0);
  const [isSyncActive, setIsSyncActive] = useState<boolean>(false);

  // Calculate graphTime whenever videoTime or lapStartVideoTime changes
  const graphTime = isSyncActive ? Math.max(0, videoTime - lapStartVideoTime) : null;

  return (
    <SyncContext.Provider value={{
      videoTime,
      setVideoTime,
      lapStartVideoTime,
      setLapStartVideoTime,
      isSyncActive,
      setIsSyncActive,
      graphTime
    }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSyncContext = () => {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSyncContext must be used within a SyncProvider');
  }
  return context;
}; 