import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { WifiOff, Wifi, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

export function OfflineIndicator() {
  const { isOnline } = useNetworkStatus();
  const { 
    syncStatus, 
    pendingCount, 
    isSyncing, 
    syncProgress,
    triggerSync, 
    retryFailedOperations 
  } = useSyncStatus();

  // Determine the state and styling
  const syncFailed = syncStatus === 'error';
  let state: 'offline' | 'syncing' | 'synced' | 'failed' = 'synced';
  let icon = <CheckCircle className="w-4 h-4" />;
  let message = 'All changes synced ✓';
  let dotColor = 'bg-green-500';
  let textColor = 'text-green-700';

  if (!isOnline) {
    state = 'offline';
    icon = <WifiOff className="w-4 h-4" />;
    message = `You're offline. ${pendingCount > 0 ? `${pendingCount} changes will sync when connected.` : 'Changes will sync when connected.'}`;
    dotColor = 'bg-red-500';
    textColor = 'text-red-700';
  } else if (syncFailed) {
    state = 'failed';
    icon = <AlertTriangle className="w-4 h-4" />;
    message = `Sync failed. ${pendingCount > 0 ? `${pendingCount} operations pending.` : ''}`;
    dotColor = 'bg-orange-500';
    textColor = 'text-orange-700';
  } else if (isSyncing) {
    state = 'syncing';
    icon = <RefreshCw className="w-4 h-4 animate-spin" />;
    message = syncProgress 
      ? `Syncing ${syncProgress.current} of ${syncProgress.total}...`
      : `Syncing... ${pendingCount > 0 ? `(${pendingCount} pending)` : ''}`;
    dotColor = 'bg-yellow-500';
    textColor = 'text-yellow-700';
  } else if (pendingCount > 0) {
    state = 'syncing';
    icon = <RefreshCw className="w-4 h-4" />;
    message = `${pendingCount} operations pending sync`;
    dotColor = 'bg-yellow-500';
    textColor = 'text-yellow-700';
  }

  const handleRetry = () => {
    if (syncFailed) {
      retryFailedOperations();
    } else {
      triggerSync();
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative flex items-center justify-center p-2 hover:bg-accent rounded-md transition-colors">
          <div className={cn("w-3 h-3 rounded-full animate-pulse", dotColor)} />
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4" align="end">
        <div className="flex items-start gap-3">
          <div className={textColor}>
            {icon}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{message}</p>
            {(syncFailed || pendingCount > 0) && isOnline && (
              <Button
                onClick={handleRetry}
                disabled={isSyncing}
                size="sm"
                variant="outline"
                className="mt-2 w-full"
              >
                {isSyncing ? 'Syncing...' : syncFailed ? 'Retry Sync' : 'Sync Now'}
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
