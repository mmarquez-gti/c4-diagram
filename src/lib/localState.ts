import type { C4Project } from './c4/types';

export interface LocalStateSnapshot {
  project: C4Project;
  activeDiagramId?: string;
}

const STORAGE_KEY = 'c4-diagram-autosave';

export function saveToLocalStorage(snapshot: LocalStateSnapshot): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore quota / security errors
  }
}

export function loadFromLocalStorage(): LocalStateSnapshot | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalStateSnapshot>;
    if (!parsed.project || typeof parsed.project !== 'object') return null;
    if (typeof parsed.project.rootDiagramId !== 'string') return null;
    if (!parsed.project.diagrams || typeof parsed.project.diagrams !== 'object') return null;
    return {
      project: parsed.project as C4Project,
      activeDiagramId: typeof parsed.activeDiagramId === 'string' ? parsed.activeDiagramId : undefined,
    };
  } catch {
    return null;
  }
}
