import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'loantracker-queue';
const DB_VERSION = 1;
const STORE_NAME = 'operations';

export interface QueuedOperation {
  id: string; // UUID
  type: 'create' | 'update' | 'delete';
  collection: 'people' | 'accounts' | 'loans' | 'payments';
  data: any; // Operation payload
  timestamp: number; // When operation was queued
  retryCount: number; // Number of sync attempts
  tempId?: string; // Temporary ID for creates
  firebaseId?: string; // Real ID after sync
  status: 'pending' | 'syncing' | 'failed';
  error?: string; // Last error message
}

class OfflineQueue {
  private db: IDBPDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('status', 'status');
          store.createIndex('collection', 'collection');
        }
      },
    });
  }

  private async ensureDb(): Promise<IDBPDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  async addToQueue(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount' | 'status'>): Promise<string> {
    const db = await this.ensureDb();
    const id = this.generateId();
    
    const queuedOp: QueuedOperation = {
      ...operation,
      id,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    };

    await db.add(STORE_NAME, queuedOp);
    console.log(`[OfflineQueue] Added operation ${id}:`, queuedOp);
    
    return id;
  }

  async getQueuedOperations(status?: QueuedOperation['status']): Promise<QueuedOperation[]> {
    const db = await this.ensureDb();
    
    if (status) {
      const index = db.transaction(STORE_NAME).store.index('status');
      return await index.getAll(status);
    }
    
    return await db.getAll(STORE_NAME);
  }

  async getOperationById(id: string): Promise<QueuedOperation | undefined> {
    const db = await this.ensureDb();
    return await db.get(STORE_NAME, id);
  }

  async updateOperation(id: string, updates: Partial<QueuedOperation>): Promise<void> {
    const db = await this.ensureDb();
    const operation = await db.get(STORE_NAME, id);
    
    if (!operation) {
      throw new Error(`Operation ${id} not found in queue`);
    }

    const updated = { ...operation, ...updates };
    await db.put(STORE_NAME, updated);
    console.log(`[OfflineQueue] Updated operation ${id}:`, updates);
  }

  async removeFromQueue(id: string): Promise<void> {
    const db = await this.ensureDb();
    await db.delete(STORE_NAME, id);
    console.log(`[OfflineQueue] Removed operation ${id}`);
  }

  async clearQueue(): Promise<void> {
    const db = await this.ensureDb();
    await db.clear(STORE_NAME);
    console.log('[OfflineQueue] Cleared all operations');
  }

  async getQueueCount(status?: QueuedOperation['status']): Promise<number> {
    const db = await this.ensureDb();
    
    if (status) {
      const index = db.transaction(STORE_NAME).store.index('status');
      return await index.count(status);
    }
    
    return await db.count(STORE_NAME);
  }

  async getPendingCount(): Promise<number> {
    return this.getQueueCount('pending');
  }

  async getFailedOperations(): Promise<QueuedOperation[]> {
    return this.getQueuedOperations('failed');
  }

  async retryFailedOperation(id: string): Promise<void> {
    await this.updateOperation(id, {
      status: 'pending',
      retryCount: 0,
      error: undefined,
    });
  }

  async incrementRetryCount(id: string): Promise<void> {
    const operation = await this.getOperationById(id);
    if (operation) {
      await this.updateOperation(id, {
        retryCount: operation.retryCount + 1,
      });
    }
  }

  async markAsFailed(id: string, error: string): Promise<void> {
    await this.updateOperation(id, {
      status: 'failed',
      error,
    });
  }

  async markAsSyncing(id: string): Promise<void> {
    await this.updateOperation(id, {
      status: 'syncing',
    });
  }

  private generateId(): string {
    return `queue-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  async getOperationsByCollection(collection: QueuedOperation['collection']): Promise<QueuedOperation[]> {
    const db = await this.ensureDb();
    const index = db.transaction(STORE_NAME).store.index('collection');
    return await index.getAll(collection);
  }

  async hasOperationsForTempId(tempId: string): Promise<boolean> {
    const operations = await this.getQueuedOperations();
    return operations.some(op => op.tempId === tempId || op.data?.id === tempId);
  }

  async updateTempIdReferences(tempId: string, firebaseId: string): Promise<void> {
    const operations = await this.getQueuedOperations();
    const db = await this.ensureDb();

    for (const op of operations) {
      let needsUpdate = false;
      const updated = { ...op };

      // Update the operation's own tempId
      if (op.tempId === tempId) {
        updated.firebaseId = firebaseId;
        needsUpdate = true;
      }

      // Update references in the data
      if (op.data) {
        if (op.data.id === tempId) {
          updated.data = { ...op.data, id: firebaseId };
          needsUpdate = true;
        }
        if (op.data.person_id === tempId) {
          updated.data = { ...op.data, person_id: firebaseId };
          needsUpdate = true;
        }
        if (op.data.account_id === tempId) {
          updated.data = { ...op.data, account_id: firebaseId };
          needsUpdate = true;
        }
        if (op.data.loan_id === tempId) {
          updated.data = { ...op.data, loan_id: firebaseId };
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await db.put(STORE_NAME, updated);
        console.log(`[OfflineQueue] Updated temp ID reference ${tempId} → ${firebaseId} in operation ${op.id}`);
      }
    }
  }
}

// Singleton instance
export const offlineQueue = new OfflineQueue();
