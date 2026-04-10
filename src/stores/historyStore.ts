import { atom } from 'nanostores';
import type { C4Project } from '../lib/c4/types';

const MAX_HISTORY = 50;

export interface HistoryState {
  past: C4Project[];
  future: C4Project[];
}

export const $history = atom<HistoryState>({ past: [], future: [] });

/**
 * Save a snapshot of the project to the undo history.
 * Call this BEFORE applying a mutating action.
 */
export function snapshot(project: C4Project): void {
  const { past } = $history.get();
  const next = [...past, project];
  $history.set({
    past: next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next,
    future: [],
  });
}

/** Returns the project to restore on undo (or null if history is empty). */
export function popUndo(): C4Project | null {
  const { past, future } = $history.get();
  if (past.length === 0) return null;
  const prev = past[past.length - 1];
  $history.set({ past: past.slice(0, -1), future });
  return prev;
}

/** Returns the project to restore on redo (or null if future is empty). */
export function popRedo(current: C4Project): C4Project | null {
  const { past, future } = $history.get();
  if (future.length === 0) return null;
  const next = future[future.length - 1];
  $history.set({ past: [...past, current], future: future.slice(0, -1) });
  return next;
}

/** Push a current project to the future stack (used by redo after undo). */
export function pushToFuture(current: C4Project): void {
  const { past, future } = $history.get();
  $history.set({ past, future: [...future, current] });
}

export function clearHistory(): void {
  $history.set({ past: [], future: [] });
}
