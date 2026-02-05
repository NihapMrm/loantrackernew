import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import { offlineQueue, QueuedOperation } from './offline-queue';
import { conflictResolver } from './conflict-resolver';

export interface SyncResult {
  success: boolean;
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ operation: QueuedOperation; error: string }>;
}

export interface SyncProgress {
  current: number;
  total: number;
  currentOperation?: QueuedOperation;
}

type SyncEventCallback = () => void;
type SyncProgressCallback = (progress: SyncProgress) => void;
type SyncCompleteCallback = (result: SyncResult) => void;
type SyncErrorCallback = (error: Error) => void;

export class SyncManager {
  private isSyncing = false;
  private onSyncStartCallbacks: SyncEventCallback[] = [];
  private onSyncCompleteCallbacks: SyncCompleteCallback[] = [];
  private onSyncErrorCallbacks: SyncErrorCallback[] = [];
  private onSyncProgressCallbacks: SyncProgressCallback[] = [];

  async processQueue(): Promise<SyncResult> {
    if (this.isSyncing) {
      console.log('[SyncManager] Sync already in progress');
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    this.emitSyncStart();

    const result: SyncResult = {
      success: false,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Initialize queue
      await offlineQueue.init();

      // Get all pending operations
      const operations = await offlineQueue.getQueuedOperations('pending');

      if (operations.length === 0) {
        console.log('[SyncManager] No operations to sync');
        result.success = true;
        return result;
      }

      console.log(`[SyncManager] Starting sync of ${operations.length} operations`);

      // Sort operations by timestamp (oldest first) and group by dependency order
      const sortedOperations = this.sortOperationsByDependency(operations);

      result.processed = sortedOperations.length;

      // Process each operation
      for (let i = 0; i < sortedOperations.length; i++) {
        const operation = sortedOperations[i];
        
        this.emitSyncProgress({
          current: i + 1,
          total: sortedOperations.length,
          currentOperation: operation,
        });

        try {
          await this.syncOperation(operation);
          result.succeeded++;
        } catch (error) {
          result.failed++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push({ operation, error: errorMessage });
          console.error(`[SyncManager] Failed to sync operation ${operation.id}:`, error);
        }
      }

      result.success = result.failed === 0;
      console.log('[SyncManager] Sync complete:', result);

      return result;
    } catch (error) {
      console.error('[SyncManager] Sync process failed:', error);
      this.emitSyncError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      this.isSyncing = false;
      this.emitSyncComplete(result);
    }
  }

  async syncOperation(operation: QueuedOperation): Promise<void> {
    console.log(`[SyncManager] Syncing operation ${operation.id}:`, operation);

    // Mark as syncing
    await offlineQueue.markAsSyncing(operation.id);

    // Increment retry count
    await offlineQueue.incrementRetryCount(operation.id);

    // Check if retry limit exceeded (max 3 attempts)
    if (operation.retryCount >= 3) {
      const error = `Max retry attempts (3) exceeded`;
      await offlineQueue.markAsFailed(operation.id, error);
      throw new Error(error);
    }

    try {
      // Check for conflicts
      const conflictCheck = await conflictResolver.checkForConflict(operation);

      if (conflictCheck.hasConflict && conflictCheck.resolution) {
        conflictResolver.logConflict(operation, conflictCheck.resolution, conflictCheck.remoteData);

        // If we should keep remote, skip this operation
        if (conflictCheck.resolution.action === 'keep-remote' || conflictCheck.resolution.action === 'skip') {
          console.log(`[SyncManager] Skipping operation ${operation.id} due to conflict:`, conflictCheck.resolution.reason);
          await offlineQueue.removeFromQueue(operation.id);
          return;
        }
      }

      // Execute the operation
      let firebaseId: string | undefined;

      switch (operation.type) {
        case 'create':
          firebaseId = await this.executeCreate(operation);
          break;
        case 'update':
          await this.executeUpdate(operation);
          firebaseId = operation.firebaseId || operation.data?.id;
          break;
        case 'delete':
          await this.executeDelete(operation);
          break;
      }

      // If this was a create with a tempId, update all references
      if (operation.tempId && firebaseId) {
        await offlineQueue.updateTempIdReferences(operation.tempId, firebaseId);
      }

      // Remove from queue on success
      await offlineQueue.removeFromQueue(operation.id);
      console.log(`[SyncManager] Successfully synced operation ${operation.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await offlineQueue.markAsFailed(operation.id, errorMessage);
      throw error;
    }
  }

  private async executeCreate(operation: QueuedOperation): Promise<string> {
    const collectionRef = collection(db, operation.collection);
    const docRef = doc(collectionRef);
    const firebaseId = docRef.id;

    const data = {
      ...operation.data,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };

    // Remove tempId from data if present
    if (data.id?.startsWith('temp-')) {
      delete data.id;
    }

    await setDoc(docRef, data);
    console.log(`[SyncManager] Created document ${firebaseId} in ${operation.collection}`);

    return firebaseId;
  }

  private async executeUpdate(operation: QueuedOperation): Promise<void> {
    const documentId = operation.firebaseId || operation.data?.id;
    if (!documentId) {
      throw new Error('No document ID for update operation');
    }

    const docRef = doc(db, operation.collection, documentId);
    
    const data = {
      ...operation.data,
      updated_at: serverTimestamp(),
    };

    // Remove id from update data
    delete data.id;

    await updateDoc(docRef, data);
    console.log(`[SyncManager] Updated document ${documentId} in ${operation.collection}`);
  }

  private async executeDelete(operation: QueuedOperation): Promise<void> {
    const documentId = operation.firebaseId || operation.data?.id;
    if (!documentId) {
      throw new Error('No document ID for delete operation');
    }

    const docRef = doc(db, operation.collection, documentId);
    await deleteDoc(docRef);
    console.log(`[SyncManager] Deleted document ${documentId} from ${operation.collection}`);
  }

  private sortOperationsByDependency(operations: QueuedOperation[]): QueuedOperation[] {
    // First, sort by timestamp (oldest first)
    const sorted = [...operations].sort((a, b) => a.timestamp - b.timestamp);

    // Then, group by collection in dependency order:
    // 1. people (no dependencies)
    // 2. accounts (no dependencies)
    // 3. loans (depends on people and accounts)
    // 4. payments (depends on loans)
    const collectionOrder: Record<string, number> = {
      people: 1,
      accounts: 2,
      loans: 3,
      payments: 4,
    };

    // Within each timestamp group, sort by collection dependency
    return sorted.sort((a, b) => {
      // If timestamps are different, maintain timestamp order
      const timeDiff = a.timestamp - b.timestamp;
      if (timeDiff !== 0) return timeDiff;

      // Same timestamp, sort by collection dependency
      const aOrder = collectionOrder[a.collection] || 999;
      const bOrder = collectionOrder[b.collection] || 999;
      return aOrder - bOrder;
    });
  }

  // Event listeners
  onSyncStart(callback: SyncEventCallback): () => void {
    this.onSyncStartCallbacks.push(callback);
    return () => {
      this.onSyncStartCallbacks = this.onSyncStartCallbacks.filter(cb => cb !== callback);
    };
  }

  onSyncComplete(callback: SyncCompleteCallback): () => void {
    this.onSyncCompleteCallbacks.push(callback);
    return () => {
      this.onSyncCompleteCallbacks = this.onSyncCompleteCallbacks.filter(cb => cb !== callback);
    };
  }

  onSyncError(callback: SyncErrorCallback): () => void {
    this.onSyncErrorCallbacks.push(callback);
    return () => {
      this.onSyncErrorCallbacks = this.onSyncErrorCallbacks.filter(cb => cb !== callback);
    };
  }

  onSyncProgress(callback: SyncProgressCallback): () => void {
    this.onSyncProgressCallbacks.push(callback);
    return () => {
      this.onSyncProgressCallbacks = this.onSyncProgressCallbacks.filter(cb => cb !== callback);
    };
  }

  private emitSyncStart(): void {
    this.onSyncStartCallbacks.forEach(cb => cb());
  }

  private emitSyncComplete(result: SyncResult): void {
    this.onSyncCompleteCallbacks.forEach(cb => cb(result));
  }

  private emitSyncError(error: Error): void {
    this.onSyncErrorCallbacks.forEach(cb => cb(error));
  }

  private emitSyncProgress(progress: SyncProgress): void {
    this.onSyncProgressCallbacks.forEach(cb => cb(progress));
  }

  getIsSyncing(): boolean {
    return this.isSyncing;
  }
}

// Singleton instance
export const syncManager = new SyncManager();
