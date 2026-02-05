import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import { QueuedOperation } from './offline-queue';

export interface ConflictResolution {
  action: 'keep-local' | 'keep-remote' | 'merge' | 'skip';
  reason: string;
  updatedData?: any;
}

export class ConflictResolver {
  /**
   * Resolve conflicts using last-write-wins strategy based on updated_at timestamps
   */
  async resolveConflict(
    operation: QueuedOperation,
    remoteData: any | null
  ): Promise<ConflictResolution> {
    // If remote data doesn't exist, keep local (it's a create or remote was deleted)
    if (!remoteData) {
      return {
        action: 'keep-local',
        reason: 'Remote document does not exist',
      };
    }

    // For deletes, always proceed (delete wins over updates)
    if (operation.type === 'delete') {
      return {
        action: 'keep-local',
        reason: 'Delete operation takes precedence',
      };
    }

    // For creates with tempId that now have a remote version, it's a conflict
    if (operation.type === 'create' && operation.tempId) {
      // Check if the remote data was created by another source
      const localTimestamp = operation.timestamp;
      const remoteTimestamp = this.extractTimestamp(remoteData.updated_at);

      if (remoteTimestamp && remoteTimestamp > localTimestamp) {
        return {
          action: 'keep-remote',
          reason: 'Remote version is newer than local create',
        };
      }

      // If our create is newer, keep it
      return {
        action: 'keep-local',
        reason: 'Local create is newer than remote',
      };
    }

    // For updates, compare timestamps
    if (operation.type === 'update') {
      const localUpdatedAt = this.extractTimestamp(operation.data.updated_at);
      const remoteUpdatedAt = this.extractTimestamp(remoteData.updated_at);

      // If we can't determine timestamps, keep local (fail-safe)
      if (!localUpdatedAt || !remoteUpdatedAt) {
        return {
          action: 'keep-local',
          reason: 'Unable to compare timestamps, keeping local changes',
        };
      }

      // Last write wins
      if (localUpdatedAt > remoteUpdatedAt) {
        return {
          action: 'keep-local',
          reason: `Local timestamp (${new Date(localUpdatedAt).toISOString()}) is newer than remote (${new Date(remoteUpdatedAt).toISOString()})`,
        };
      } else if (remoteUpdatedAt > localUpdatedAt) {
        return {
          action: 'keep-remote',
          reason: `Remote timestamp (${new Date(remoteUpdatedAt).toISOString()}) is newer than local (${new Date(localUpdatedAt).toISOString()})`,
        };
      } else {
        // Same timestamp, keep local (user's device wins in ties)
        return {
          action: 'keep-local',
          reason: 'Timestamps are equal, keeping local changes',
        };
      }
    }

    // Default: keep local
    return {
      action: 'keep-local',
      reason: 'Default conflict resolution',
    };
  }

  /**
   * Fetch current remote state for conflict checking
   */
  async fetchRemoteState(
    collection: string,
    documentId: string
  ): Promise<any | null> {
    try {
      const docRef = doc(db, collection, documentId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }

      return null;
    } catch (error) {
      console.error(`[ConflictResolver] Error fetching remote state:`, error);
      return null;
    }
  }

  /**
   * Check if an operation will conflict with remote state
   */
  async checkForConflict(operation: QueuedOperation): Promise<{
    hasConflict: boolean;
    resolution?: ConflictResolution;
    remoteData?: any;
  }> {
    // Creates with tempId won't have remote conflicts yet
    if (operation.type === 'create' && operation.tempId && !operation.firebaseId) {
      return { hasConflict: false };
    }

    // Get the document ID to check
    const documentId = operation.firebaseId || operation.data?.id;
    if (!documentId) {
      return { hasConflict: false };
    }

    // Fetch remote state
    const remoteData = await this.fetchRemoteState(operation.collection, documentId);

    // Resolve conflict
    const resolution = await this.resolveConflict(operation, remoteData);

    // If we should keep remote or skip, there's a conflict
    const hasConflict = resolution.action === 'keep-remote' || resolution.action === 'skip';

    return {
      hasConflict,
      resolution,
      remoteData,
    };
  }

  /**
   * Extract timestamp from Firestore Timestamp or Date or number
   */
  private extractTimestamp(value: any): number | null {
    if (!value) return null;

    // Firestore Timestamp
    if (value instanceof Timestamp) {
      return value.toMillis();
    }

    // Firestore Timestamp-like object (from .data())
    if (value.seconds !== undefined) {
      return value.seconds * 1000 + (value.nanoseconds || 0) / 1000000;
    }

    // Date object
    if (value instanceof Date) {
      return value.getTime();
    }

    // Number (Unix timestamp in milliseconds)
    if (typeof value === 'number') {
      return value;
    }

    // String (ISO date)
    if (typeof value === 'string') {
      const parsed = new Date(value).getTime();
      return isNaN(parsed) ? null : parsed;
    }

    return null;
  }

  /**
   * Log conflict for debugging
   */
  logConflict(operation: QueuedOperation, resolution: ConflictResolution, remoteData?: any): void {
    console.warn('[ConflictResolver] Conflict detected:', {
      operation: {
        id: operation.id,
        type: operation.type,
        collection: operation.collection,
        timestamp: new Date(operation.timestamp).toISOString(),
      },
      resolution,
      remoteData: remoteData ? {
        id: remoteData.id,
        updated_at: remoteData.updated_at,
      } : null,
    });
  }
}

// Singleton instance
export const conflictResolver = new ConflictResolver();
