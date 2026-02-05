import { useState, useEffect } from 'react';
import { offlineQueue } from '@/lib/offline-queue';
import { syncManager, SyncResult, SyncProgress } from '@/lib/sync-manager';
import { useNetworkStatus } from './useNetworkStatus';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface UseSyncStatusReturn {
  syncStatus: SyncStatus;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncResult: SyncResult | null;
  syncProgress: SyncProgress | null;
  triggerSync: () => Promise<void>;
  retryFailedOperations: () => Promise<void>;
  clearQueue: () => Promise<void>;
}

export function useSyncStatus(): UseSyncStatusReturn {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const { isOnline } = useNetworkStatus();

  // Update pending count periodically
  useEffect(() => {
    const updatePendingCount = async () => {
      try {
        await offlineQueue.init();
        const count = await offlineQueue.getPendingCount();
        setPendingCount(count);
      } catch (error) {
        console.error('[useSyncStatus] Error getting pending count:', error);
      }
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0 && syncStatus === 'idle') {
      console.log('[useSyncStatus] Network restored, triggering auto-sync');
      triggerSync();
    }
  }, [isOnline, pendingCount]);

  // Subscribe to sync events
  useEffect(() => {
    const unsubStart = syncManager.onSyncStart(() => {
      setSyncStatus('syncing');
      setSyncProgress(null);
    });

    const unsubComplete = syncManager.onSyncComplete((result) => {
      setLastSyncResult(result);
      setSyncStatus(result.success ? 'success' : 'error');
      setSyncProgress(null);

      // Update pending count immediately after sync
      offlineQueue.getPendingCount().then(setPendingCount);

      // Auto-reset to idle after showing success/error
      setTimeout(() => {
        setSyncStatus('idle');
      }, 3000);
    });

    const unsubError = syncManager.onSyncError((error) => {
      console.error('[useSyncStatus] Sync error:', error);
      setSyncStatus('error');
      setSyncProgress(null);

      // Reset to idle after error
      setTimeout(() => {
        setSyncStatus('idle');
      }, 5000);
    });

    const unsubProgress = syncManager.onSyncProgress((progress) => {
      setSyncProgress(progress);
    });

    return () => {
      unsubStart();
      unsubComplete();
      unsubError();
      unsubProgress();
    };
  }, []);

  const triggerSync = async () => {
    if (!isOnline) {
      console.log('[useSyncStatus] Cannot sync while offline');
      return;
    }

    if (syncManager.getIsSyncing()) {
      console.log('[useSyncStatus] Sync already in progress');
      return;
    }

    try {
      await syncManager.processQueue();
    } catch (error) {
      console.error('[useSyncStatus] Error triggering sync:', error);
    }
  };

  const retryFailedOperations = async () => {
    try {
      const failedOps = await offlineQueue.getFailedOperations();
      
      for (const op of failedOps) {
        await offlineQueue.retryFailedOperation(op.id);
      }

      // Update pending count
      const count = await offlineQueue.getPendingCount();
      setPendingCount(count);

      // Trigger sync if online
      if (isOnline) {
        await triggerSync();
      }
    } catch (error) {
      console.error('[useSyncStatus] Error retrying failed operations:', error);
    }
  };

  const clearQueue = async () => {
    try {
      await offlineQueue.clearQueue();
      setPendingCount(0);
    } catch (error) {
      console.error('[useSyncStatus] Error clearing queue:', error);
    }
  };

  return {
    syncStatus,
    pendingCount,
    isSyncing: syncManager.getIsSyncing(),
    lastSyncResult,
    syncProgress,
    triggerSync,
    retryFailedOperations,
    clearQueue,
  };
}
