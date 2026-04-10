import { atom } from 'nanostores';
import type { C4Node, C4Edge } from '../lib/c4/types';

/** Currently selected node ID (null = nothing selected) */
export const $selectedNodeId = atom<string | null>(null);

/** Currently selected edge ID (null = nothing selected) */
export const $selectedEdgeId = atom<string | null>(null);

export function selectNode(nodeId: string | null): void {
  $selectedNodeId.set(nodeId);
  if (nodeId !== null) $selectedEdgeId.set(null);
}

export function selectEdge(edgeId: string | null): void {
  $selectedEdgeId.set(edgeId);
  if (edgeId !== null) $selectedNodeId.set(null);
}

export function clearSelection(): void {
  $selectedNodeId.set(null);
  $selectedEdgeId.set(null);
}
