import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'lt_pinned_loans';
const PIN_EVENT = 'lt_pinned_changed';

function load(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event(PIN_EVENT));
}

/** Drop pins for loans that no longer exist (deleted, or replaced by an import) */
export function unpinLoans(ids: string[]) {
  const current = load();
  const next = current.filter(i => !ids.includes(i));
  if (next.length !== current.length) save(next);
}

/** Keep only pins whose loan is in `existingIds` */
export function prunePinnedLoans(existingIds: Set<string>) {
  const current = load();
  const next = current.filter(i => existingIds.has(i));
  if (next.length !== current.length) save(next);
}

export function usePinnedLoans() {
  const [pinnedIds, setPinnedIds] = useState<string[]>(load);

  useEffect(() => {
    const handler = () => setPinnedIds(load());
    window.addEventListener(PIN_EVENT, handler);
    return () => window.removeEventListener(PIN_EVENT, handler);
  }, []);

  const pin = useCallback((id: string) => {
    const next = load().includes(id) ? load() : [id, ...load()];
    save(next);
    setPinnedIds(next);
  }, []);

  const unpin = useCallback((id: string) => {
    const next = load().filter(i => i !== id);
    save(next);
    setPinnedIds(next);
  }, []);

  const toggle = useCallback((id: string) => {
    const current = load();
    const next = current.includes(id)
      ? current.filter(i => i !== id)
      : [id, ...current];
    save(next);
    setPinnedIds(next);
  }, []);

  const isPinned = useCallback((id: string) => pinnedIds.includes(id), [pinnedIds]);

  return { pinnedIds, pin, unpin, toggle, isPinned };
}
