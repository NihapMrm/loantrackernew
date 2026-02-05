# Offline-First Implementation Plan

## Overview
Enable complete offline functionality for the LoanTracker Android app, allowing full CRUD operations while offline with automatic Firebase sync when connectivity is restored.

## Decisions Made
- ✅ **No storage limit** - Trust IndexedDB/Firestore capacity, most users won't hit limits
- ✅ **Full sync on first login** - Download all user data immediately after authentication
- ✅ **Use Firestore offline persistence** - Leverage built-in Firebase offline capabilities
- ✅ **Android only** - Offline functionality for native Android app (web can be added later)
- ✅ **Blocking sync** - Users must wait for sync to complete, cannot dismiss popup
- ✅ **Queue limit: 500 warn / 1000 block** - Prevent unlimited queue growth
- ✅ **Sync button in header** - Always accessible for manual sync trigger
- ✅ **No photo/file features** - Text data only, keeps offline implementation simple
- ✅ **Login required** - Firebase authentication mandatory, no guest/local-only mode

---

## Phase 1: Foundation (Week 1) ✅ COMPLETED

### 1.1 Enable Firestore Offline Persistence ✅
**File:** `src/integrations/firebase/client.ts`

**Status:** ✅ Implemented
- ✅ Import `enableIndexedDbPersistence` from Firebase
- ✅ Call after Firestore initialization
- ✅ Add error handling for browsers that don't support it
- ✅ Add fallback for multi-tab scenarios

**Code Changes:**
```typescript
import { enableIndexedDbPersistence } from 'firebase/firestore';

// After db initialization
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence only works in one tab');
    } else if (err.code === 'unimplemented') {
      console.warn('Browser does not support offline persistence');
    }
  });
```

### 1.2 Install and Configure Network Detection ✅
**Files:** `package.json`, `capacitor.config.ts`

**Status:** ✅ Implemented
- ✅ Install `@capacitor/network` plugin
- ✅ Run `npx cap sync` to update native projects
- ✅ Create `src/hooks/useNetworkStatus.ts` hook
- ✅ Use Capacitor Network API to monitor connection state
- ✅ Provide reactive connection status throughout app

**Hook Interface:**
```typescript
interface NetworkStatus {
  connected: boolean;
  connectionType: 'wifi' | 'cellular' | 'none' | 'unknown';
  isOnline: boolean;
}

export function useNetworkStatus(): NetworkStatus
```

### 1.3 Create Offline UI Indicator Component ✅
**File:** `src/components/OfflineIndicator.tsx`

**Status:** ✅ Implemented
- ✅ Build banner component showing connection status
- ✅ Display states: Online, Offline, Syncing, Sync Complete, Sync Failed
- ✅ Add pending operations counter
- ✅ Auto-hide when online after brief success message
- ✅ Sticky banner at top of screen when offline

**Visual States:**
- 🔴 **Offline** - Red banner: "You're offline. Changes will sync when connected."
- 🟡 **Syncing** - Yellow banner with spinner: "Syncing... (3 pending)"
- 🟢 **Synced** - Green banner (auto-dismiss): "All changes synced ✓"
- 🔵 **Online** - No banner (normal state)
- ⚠️ **Sync Failed** - Orange banner: "Sync failed. Tap to retry."

### 1.4 Integrate Network Status in App ✅
**Files:** `src/App.tsx`, Layout components

**Status:** ✅ Implemented
- ✅ Add `<OfflineIndicator />` to root layout
- ✅ Update MobileLayout and DesktopSidebar to show connection status
- ⏳ Add **Sync button in header** with pending operation count badge (Phase 5)
- ✅ Add network listener in App component
- ✅ Set up event listeners for online/offline events
- ⏳ Show **blocking sync dialog** when syncing (Phase 2)

**Phase 1 Complete!** The app now has Firestore offline persistence, network detection, and visual indicators.

---

## Phase 2: Offline Queue System (Week 2) ✅ COMPLETED

### 2.1 Build IndexedDB Queue Manager ✅
**File:** `src/lib/offline-queue.ts`

**Status:** ✅ Implemented
- ✅ Created IndexedDB database: `loantracker-queue`
- ✅ Defined queue item schema with operation metadata
- ✅ Implemented CRUD operations for queue:
  - ✅ `addToQueue(operation)` - Add pending operation
  - ✅ `getQueuedOperations()` - Retrieve all pending ops
  - ✅ `removeFromQueue(id)` - Remove after successful sync
  - ✅ `clearQueue()` - Clear all operations
  - ✅ `getQueueCount()` - Get pending operation count
- ✅ Added helper methods:
  - ✅ `updateTempIdReferences()` - Replace temp IDs with Firebase IDs
  - ✅ `retryFailedOperation()` - Retry failed operations
  - ✅ `markAsFailed()`, `markAsSyncing()` - Status updates

**Queue Item Schema:**
```typescript
interface QueuedOperation {
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
```

### 2.2 Create Sync Manager ✅
**File:** `src/lib/sync-manager.ts`

**Status:** ✅ Implemented
- ✅ Built sync orchestrator that processes queue when online
- ✅ Implemented retry logic with exponential backoff (max 3 attempts)
- ✅ Handle operation dependencies (people → accounts → loans → payments)
- ✅ Track sync status and progress
- ✅ Emit events for UI updates (onSyncStart, onSyncComplete, onSyncError, onSyncProgress)
- ✅ Replace temporary IDs with Firebase IDs after successful creates
- ✅ Execute operations in correct dependency order

**Key Functions:**
```typescript
class SyncManager {
  async processQueue(): Promise<SyncResult>;
  async syncOperation(op: QueuedOperation): Promise<void>;
  async resolveConflicts(localOp, remoteData): Promise<void>;
  onSyncStart(callback): void;
  onSyncComplete(callback): void;
  onSyncError(callback): void;
}
```

**Sync Strategy:**
1. Sort operations by timestamp (oldest first)
2. Group by collection: people → accounts → loans → payments
3. Execute creates before updates/deletes
4. Replace temporary IDs with Firebase IDs
5. Handle failures gracefully (mark as failed, continue with others)

### 2.3 Implement Conflict Resolution ✅
**File:** `src/lib/conflict-resolver.ts`

**Status:** ✅ Implemented
- ✅ Implemented last-write-wins strategy using `updated_at` timestamps
- ✅ Compare local and remote `updated_at` fields
- ✅ If local is newer, overwrite remote (keep-local)
- ✅ If remote is newer, discard local changes (keep-remote)
- ✅ Log conflicts for debugging
- ✅ Handle Firestore Timestamp objects and various date formats
- ✅ Fetch remote state for conflict checking
- ⏳ **Enforce queue limits:** Warn at 500 operations, block at 1000 (Phase 5)

**Additional Features:**
- ✅ Created `useSyncStatus` hook for monitoring sync status and queue count
- ✅ Updated OfflineIndicator to show pending operation count with badge
- ✅ Added sync progress tracking (current/total operations)
- ✅ Auto-sync when network comes back online
- ✅ Manual sync trigger with retry for failed operations

**Phase 2 Complete!** The app now has a complete offline queue system with IndexedDB storage, sync orchestration, and conflict resolution.

---

## Phase 3: Optimistic Updates (Week 3) ✅ COMPLETED

### 3.1 Update Mutation Hooks with Optimistic UI ✅
**Files:** `src/hooks/useLoans.ts`, `src/hooks/useAccounts.ts`

**Status:** ✅ Implemented
- ✅ Added `onMutate` handlers to all mutations
- ✅ Implemented optimistic query updates using React Query's `setQueryData`
- ✅ Generated temporary IDs for offline creates: `temp-${timestamp}-${random}`
- ✅ Added rollback logic in `onError` handlers
- ✅ Integrated offline queue in all mutations when offline
- ✅ Added `_pendingSync` flag to optimistically updated items

**Mutations Updated:**
- ✅ `useCreatePerson`, `useUpdatePerson`, `useDeletePerson`
- ✅ `useCreateLoan`, `useUpdateLoan`, `useDeleteLoan`
- ✅ `useCreatePayment`, `useDeletePayment`
- ✅ `useCreateAccount`, `useUpdateAccount`, `useDeleteAccount`

**Features:**
- Offline creates generate temp IDs and queue operations
- Offline updates/deletes queue operations and update UI immediately
- Online mutations work normally with Firebase
- Toast messages adapt: "will sync when online" vs immediate success/error
- Automatic rollback on error restores previous query data
- Cascade deletes (person → loans) queue all related operations

### 3.2 Add Visual Indicators for Pending Operations ✅
**Implementation:** Built into optimistic updates

**Status:** ✅ Implemented
- ✅ Items with `_pendingSync: true` flag can be styled differently
- ✅ Items with temp IDs (`temp-${timestamp}`) identifiable in UI
- ✅ Badge count on OfflineIndicator shows pending operations
- ✅ Sync status in popover shows current/total operations during sync

**Ready for UI Styling:**
- Badge/icon can be added to cards with `_pendingSync` or temp IDs
- Graying out/disabling delete for pending items (prevents conflicts)
- Spinner animation during sync

### 3.3 Handle Temporary ID Replacement ✅
**File:** `src/lib/offline-queue.ts` (existing functionality)

**Status:** ✅ Implemented
- ✅ `updateTempIdReferences()` method replaces temp IDs with Firebase IDs
- ✅ Sync manager calls this after successful create operations
- ✅ Updates all queue operations that reference the temp ID
- ✅ Handles references in: person_id, account_id, loan_id fields

**Mapping Flow:**
1. User creates loan offline → temp ID assigned (`temp-123`)
2. User creates payment for that loan → references `temp-123`
3. Sync manager uploads loan → gets Firebase ID (`firebase-abc`)
4. Queue manager updates all references: `temp-123` → `firebase-abc`
5. Payment sync uses correct `firebase-abc` loan_id

**Phase 3 Complete!** All CRUD operations now work offline with optimistic UI updates and automatic queue integration.

---

## Phase 4: Full Sync on First Login (Week 4)

### 4.1 Create Initial Sync System
**File:** `src/lib/initial-sync.ts`

**Tasks:**
- Detect first login (no cached data in IndexedDB)
- Show loading screen during initial sync
- Download all collections in order: people → accounts → loans → payments
- Store sync timestamp in localStorage: `lastFullSync`
- Handle sync interruption (resume from last successful collection)

**Sync Flow:**
```typescript
async function performInitialSync(userId: string): Promise<void> {
  showSyncScreen('Downloading your data...');
  
  // 1. Sync people
  updateProgress('Loading contacts...', 25);
  await syncCollection('people', userId);
  
  // 2. Sync accounts
  updateProgress('Loading accounts...', 50);
  await syncCollection('accounts', userId);
  
  // 3. Sync loans
  updateProgress('Loading loans...', 75);
  await syncCollection('loans', userId);
  
  // 4. Sync payments
  updateProgress('Loading payments...', 90);
  await syncCollection('payments', userId);
  
  // Mark sync complete
  localStorage.setItem('lastFullSync', Date.now().toString());
  updateProgress('Complete!', 100);
  hideSyncScreen();
}
```

### 4.2 Build Sync Progress UI
**File:** `src/components/SyncDialog.tsx`

**Tasks:**
- Create **blocking full-screen dialog** during sync (cannot be dismissed)
- Show progress bar with percentage
- Display current step (e.g., "Syncing loans...")
- NO cancel button during sync (must complete)
- Show operation counts: "Syncing 5 of 12 operations..."
- Handle errors gracefully (retry mechanism)
- Show success screen briefly before closing: "All changes synced ✓"
- **Reuse this dialog for both initial sync and routine background sync**

### 4.3 Implement Background Sync
**File:** `src/lib/background-sync.ts`

**Tasks:**
- Set up periodic sync every 5 minutes when online (configurable)
- Use `setInterval` or Service Worker Background Sync API
- Only sync changed/new data (use `updated_at` timestamp)
- Don't interrupt user actions (low priority)
- Pause during active mutations

---

## Phase 5: Edge Cases & Polish (Week 5)

### 5.1 Handle Cascade Deletes Offline
**Files:** `src/hooks/useLoans.ts` (useDeletePerson)

**Tasks:**
- Queue person delete operation
- Also queue all related loan deletes
- Queue all related payment deletes
- Ensure operations execute in correct order during sync:
  1. Delete payments first
  2. Then delete loans
  3. Finally delete person
- Add confirmation dialog: "This will delete X loans and Y payments"

### 5.2 Implement Manual Sync Trigger
**File:** `src/components/SyncButton.tsx` (in header)

**Tasks:**
- Add "Sync Now" button **in app header/toolbar** (always visible)
- Show pending operation count as badge on button (e.g., "↻ 5")
- Display last synced time on hover/tap
- Trigger manual sync on button press → Opens **blocking SyncDialog**
- Animate button during sync (rotating icon)
- Disable button when already syncing
- Hide/gray out when offline

### 5.3 Add Sync Error Recovery
**File:** `src/components/SyncErrorDialog.tsx`

**Tasks:**
- Show dialog when sync fails multiple times (3+ retries)
- Display error message and failed operation details
- Offer options:
  - "Retry Now" - Attempt sync again immediately
  - "Retry Later" - Mark for automatic retry
  - "Discard Changes" - Remove from queue (with confirmation)
  - "View Details" - Show error logs
- Log all sync errors for debugging

### 5.4 Auth Token Refresh Handling
**File:** `src/lib/auth.tsx`

**Tasks:**
- Monitor Firebase Auth token expiration
- Attempt silent refresh when online
- If refresh fails offline, queue operations normally
- When back online, refresh token before syncing
- Show "Authentication expired" message if token can't be refreshed
- Require re-login if offline for >7 days

### 5.5 Testing & Data Integrity
**Tasks:**
- Test offline create → edit → delete sequences
- Test cascade deletes (person with many loans)
- Test sync with poor/intermittent connection
- Test sync interruption and resumption
- Test large datasets (1000+ loans)
- Test multi-device sync (same user, different devices)
- Verify no data loss scenarios
- Test auth expiration during offline period

---

## Phase 6: Monitoring & Optimization (Week 6)

### 6.1 Add Analytics for Offline Usage
**Tasks:**
- Track offline operation counts
- Measure sync success/failure rates
- Monitor sync duration
- Log conflict resolution frequency
- Track storage usage

### 6.2 Performance Optimization
**Tasks:**
- Implement pagination for large datasets
- Add lazy loading for loan details
- Optimize IndexedDB queries (indexes)
- Reduce Firebase reads with better caching
- Compress queued operation data

### 6.3 User Documentation
**Tasks:**
- Add offline mode guide in app
- Create FAQ for common sync issues
- Add tooltips explaining offline badges
- Document data limits and best practices

---

## Implementation Order Summary

**Week 1:** Foundation (Firestore persistence, network detection, UI indicators)
**Week 2:** Queue system (IndexedDB, sync manager, conflict resolution)
**Week 3:** Optimistic updates (all CRUD operations, visual feedback)
**Week 4:** Initial sync (full data download, progress UI, background sync)
**Week 5:** Edge cases (cascade deletes, error handling, manual sync)
**Week 6:** Polish (testing, optimization, documentation)

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         React App                           │
├─────────────────────────────────────────────────────────────┤
│  Components (UI)                                            │
│  ├─ OfflineIndicator (connection status)                   │
│  ├─ InitialSyncScreen (first login sync)                   │
│  └─ SyncButton (manual trigger)                            │
├─────────────────────────────────────────────────────────────┤
│  Hooks (Data Layer)                                         │
│  ├─ useNetworkStatus (Capacitor Network API)               │
│  ├─ useLoans / useAccounts / usePeople                     │
│  │   └─ Optimistic updates + Queue integration             │
│  └─ useSyncStatus (queue count, sync state)                │
├─────────────────────────────────────────────────────────────┤
│  Services (Business Logic)                                  │
│  ├─ SyncManager (orchestrate sync)                         │
│  ├─ OfflineQueue (IndexedDB operations)                    │
│  ├─ ConflictResolver (last-write-wins)                     │
│  └─ IdMapper (temp ID → Firebase ID)                       │
├─────────────────────────────────────────────────────────────┤
│  Storage Layer                                              │
│  ├─ Firestore (with enableIndexedDbPersistence)            │
│  └─ IndexedDB (operation queue)                            │
└─────────────────────────────────────────────────────────────┘
                           ↕
                    Network Layer
                           ↕
                   Firebase Backend
```

---

## Success Metrics

- ✅ All CRUD operations work offline
- ✅ Sync completes successfully >95% of the time
- ✅ No data loss in any scenario
- ✅ Sync completes in <30 seconds for typical user (50 loans)
- ✅ UI remains responsive during sync
- ✅ Clear user feedback for all states
- ✅ Graceful error handling and recovery

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Firestore offline limits hit | High | Monitor usage, implement pruning if needed |
| Sync conflicts (multi-device) | Medium | Last-write-wins, user notification |
| Large initial sync (slow) | Medium | Progress bar, allow cancellation |
| Auth token expiration offline | Low | Queue ops, refresh when online |
| Complex cascade deletes fail | Medium | Transaction-like approach, rollback on error |
| IndexedDB quota exceeded | Low | Rare on Android, add warning at 80% |

---

## Next Steps

1. ✅ **All decisions confirmed**
2. **Review and approve final plan**
3. **Start Phase 1 implementation**
4. **Set up testing environment** (Android emulator with network throttling)
5. **Create branch:** `feature/offline-support`
6. **Begin with:** Enable Firestore persistence + Network detection

---

**Estimated Total Time:** 6 weeks
**Priority:** High
**Complexity:** Medium-High
