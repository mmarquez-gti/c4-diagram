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
 * Clears the redo (future) stack — a new action cancels pending redos.
 */
export function snapshot(project: C4Project): void {
  const { past } = $history.get();
  const next = [...past, project];
  $history.set({
    past: next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next,
    // Clear redo stack: taking a new action after undo discards the future
    future: [],
  });
}

export function clearHistory(): void {
  $history.set({ past: [], future: [] });
}
