import { useState, useEffect, useCallback, useRef } from 'react';
import { firestoreSyncService } from '../services/firestoreSyncService';

export interface NetworkStatus {
  isOnline: boolean;
  isOffline: boolean;
  isBasementMode: boolean;
  isRetrying: boolean;
  justReconnected: boolean;
  retryConnection: () => Promise<boolean>;
}

/**
 * Hook that listens to network and Cloud Firestore connectivity status in real time.
 * Detects offline state, basement bar mode, and handles seamless reconnection notifications.
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() => firestoreSyncService.isOnline());
  const [isBasementMode, setIsBasementMode] = useState<boolean>(() => firestoreSyncService.isBasementMode());
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [justReconnected, setJustReconnected] = useState<boolean>(false);
  const prevOnlineRef = useRef<boolean>(isOnline);

  useEffect(() => {
    const unsub = firestoreSyncService.onNetworkStatusChange((online, basement) => {
      const currentlyOnline = online && !basement;
      setIsOnline(currentlyOnline);
      setIsBasementMode(basement);

      if (!prevOnlineRef.current && currentlyOnline) {
        // Show subtle reconnection reassurance banner briefly
        setJustReconnected(true);
        const timer = setTimeout(() => {
          setJustReconnected(false);
        }, 3000);
        return () => clearTimeout(timer);
      }
      prevOnlineRef.current = currentlyOnline;
    });

    return unsub;
  }, []);

  const retryConnection = useCallback(async (): Promise<boolean> => {
    setIsRetrying(true);
    try {
      const connected = await firestoreSyncService.verifyConnection();
      if (connected) {
        await firestoreSyncService.flushOfflineQueue();
        setIsOnline(true);
        setJustReconnected(true);
        setTimeout(() => setJustReconnected(false), 3000);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setIsRetrying(false);
    }
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    isBasementMode,
    isRetrying,
    justReconnected,
    retryConnection,
  };
}
