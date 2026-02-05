import { useEffect, useState } from 'react';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

export interface NetworkStatus {
  connected: boolean;
  connectionType: 'wifi' | 'cellular' | 'none' | 'unknown';
  isOnline: boolean;
}

export function useNetworkStatus(): NetworkStatus {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    connected: true,
    connectionType: 'unknown',
    isOnline: true,
  });

  useEffect(() => {
    // Only use Capacitor Network on native platforms
    const isNative = Capacitor.isNativePlatform();

    const checkStatus = async () => {
      if (isNative) {
        try {
          const status = await Network.getStatus();
          setNetworkStatus({
            connected: status.connected,
            connectionType: status.connectionType,
            isOnline: status.connected,
          });
        } catch (error) {
          console.error('Error checking network status:', error);
        }
      } else {
        // Fallback to browser API for web
        setNetworkStatus({
          connected: navigator.onLine,
          connectionType: navigator.onLine ? 'unknown' : 'none',
          isOnline: navigator.onLine,
        });
      }
    };

    // Check initial status
    checkStatus();

    if (isNative) {
      // Listen for network changes on native
      let listenerHandle: any = null;
      
      Network.addListener('networkStatusChange', (status) => {
        setNetworkStatus({
          connected: status.connected,
          connectionType: status.connectionType,
          isOnline: status.connected,
        });
      }).then((handle) => {
        listenerHandle = handle;
      });

      return () => {
        if (listenerHandle) {
          listenerHandle.remove();
        }
      };
    } else {
      // Listen for online/offline events on web
      const handleOnline = () => {
        setNetworkStatus({
          connected: true,
          connectionType: 'unknown',
          isOnline: true,
        });
      };

      const handleOffline = () => {
        setNetworkStatus({
          connected: false,
          connectionType: 'none',
          isOnline: false,
        });
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  return networkStatus;
}
