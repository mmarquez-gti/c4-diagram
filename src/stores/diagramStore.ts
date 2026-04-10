import { atom } from 'nanostores';
import type { C4Project, C4Diagram } from '../lib/c4/types';

/** The currently open project (null when nothing is loaded) */
export const $project = atom<C4Project | null>(null);

/** ID of the diagram currently shown in the canvas */
export const $activeDiagramId = atom<string | null>(null);

/**
 * Navigation breadcrumb — ordered list of diagram IDs from root to current.
 * Push when drilling into a sub-diagram, pop when navigating back.
 */
export const $navigationStack = atom<string[]>([]);

/** Derive the currently active diagram from the store (read-only helper). */
export function getActiveDiagram(): C4Diagram | null {
  const project = $project.get();
  const id = $activeDiagramId.get();
  if (!project || !id) return null;
  return project.diagrams[id] ?? null;
}
