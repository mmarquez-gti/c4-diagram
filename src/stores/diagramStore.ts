import { atom } from 'nanostores';
import type { C4Diagram, C4Edge, C4Node, C4NodeType, C4Project } from '../lib/c4/types';
import {
  addEdgeToProject,
  addNodeToProject,
  createEdge,
  createNode,
  createProject as modelCreateProject,
  createSubdiagram,
  removeEdgeFromProject,
  removeNodeFromProject,
  updateEdgeInProject,
  updateNodeInProject,
  type CreateNodeOptions,
} from '../lib/c4/model';
import { $history, snapshot, clearHistory } from './historyStore';
import { clearSelection } from './selectionStore';
import { saveToLocalStorage } from '../lib/localState';

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

/** The currently open project (null when nothing is loaded) */
export const $project = atom<C4Project | null>(null);

/** ID of the diagram currently shown in the canvas */
export const $activeDiagramId = atom<string | null>(null);

/**
 * Navigation breadcrumb — ordered list of diagram IDs from root to current.
 * Push when drilling into a sub-diagram, pop when navigating back.
 */
export const $navigationStack = atom<string[]>([]);



// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/** Derive the currently active diagram from the store (read-only helper). */
export function getActiveDiagram(): C4Diagram | null {
  const project = $project.get();
  const id = $activeDiagramId.get();
  if (!project || !id) return null;
  return project.diagrams[id] ?? null;
}

// ---------------------------------------------------------------------------
// Mutating actions
// ---------------------------------------------------------------------------

/** Create (or reset) a project and set it as active. */
export function createProject(name?: string): void {
  clearHistory();
  clearSelection();
  const project = modelCreateProject(name);
  $project.set(project);
  $activeDiagramId.set(project.rootDiagramId);
  $navigationStack.set([project.rootDiagramId]);
}

/** Load an existing project into the store. */
export function loadProject(project: C4Project): void {
  clearHistory();
  clearSelection();
  $project.set(project);
  $activeDiagramId.set(project.rootDiagramId);
  $navigationStack.set([project.rootDiagramId]);
}

function withSnapshot<T>(fn: () => T): T {
  const current = $project.get();
  if (current) snapshot(current);
  return fn();
}

/** Add a new node to the active diagram. */
export function addNode(options: CreateNodeOptions = {}): C4Node | null {
  const project = $project.get();
  const diagramId = $activeDiagramId.get();
  if (!project || !diagramId) return null;
  const node = createNode(options);
  withSnapshot(() => {
    $project.set(addNodeToProject(project, diagramId, node));
  });
  return node;
}

/** Update a node's position in the active diagram.
 * Intentionally does NOT snapshot to history — drag events fire continuously
 * and snapshotting every pixel would flood the undo stack.
 */
export function updateNodePosition(nodeId: string, x: number, y: number): void {
  const project = $project.get();
  const diagramId = $activeDiagramId.get();
  if (!project || !diagramId) return;
  $project.set(updateNodeInProject(project, diagramId, nodeId, { position: { x, y } }));
}

/** Update a node's size in the active diagram.
 * Intentionally does NOT snapshot to history — resize events fire continuously.
 */
export function updateNodeSize(nodeId: string, width: number, height: number): void {
  const project = $project.get();
  const diagramId = $activeDiagramId.get();
  if (!project || !diagramId) return;
  $project.set(updateNodeInProject(project, diagramId, nodeId, { size: { width, height } }));
}

/** Update arbitrary fields on a node in the active diagram. */
export function updateNode(nodeId: string, patch: Partial<Omit<C4Node, 'id'>>): void {
  const project = $project.get();
  const diagramId = $activeDiagramId.get();
  if (!project || !diagramId) return;
  withSnapshot(() => {
    $project.set(updateNodeInProject(project, diagramId, nodeId, patch));
  });
}

/** Remove a node (and any connected edges) from the active diagram. */
export function removeNode(nodeId: string): void {
  const project = $project.get();
  const diagramId = $activeDiagramId.get();
  if (!project || !diagramId) return;
  withSnapshot(() => {
    $project.set(removeNodeFromProject(project, diagramId, nodeId));
  });
}

/** Add a new edge between two nodes in the active diagram. */
export function addEdge(
  source: string,
  target: string,
  sourceHandle?: string,
  targetHandle?: string,
  label?: string,
  technology?: string,
): C4Edge | null {
  const project = $project.get();
  const diagramId = $activeDiagramId.get();
  if (!project || !diagramId) return null;
  const edge = createEdge({ source, target, sourceHandle, targetHandle, label, technology });
  withSnapshot(() => {
    $project.set(addEdgeToProject(project, diagramId, edge));
  });
  return edge;
}

/** Update arbitrary fields on an edge in the active diagram. */
export function updateEdge(edgeId: string, patch: Partial<Omit<C4Edge, 'id'>>): void {
  const project = $project.get();
  const diagramId = $activeDiagramId.get();
  if (!project || !diagramId) return;
  withSnapshot(() => {
    $project.set(updateEdgeInProject(project, diagramId, edgeId, patch));
  });
}

/** Remove an edge from the active diagram. */
export function removeEdge(edgeId: string): void {
  const project = $project.get();
  const diagramId = $activeDiagramId.get();
  if (!project || !diagramId) return;
  withSnapshot(() => {
    $project.set(removeEdgeFromProject(project, diagramId, edgeId));
  });
}

/** Drill into a node's sub-diagram (create one if it doesn't exist). */
export function enterSubdiagram(nodeId: string): void {
  const project = $project.get();
  const diagramId = $activeDiagramId.get();
  if (!project || !diagramId) return;

  const diagram = project.diagrams[diagramId];
  if (!diagram) return;

  const node = diagram.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  let targetDiagramId = node.childDiagramId;

  if (!targetDiagramId || !project.diagrams[targetDiagramId]) {
    // Create a new sub-diagram on the fly
    withSnapshot(() => {
      const updated = createSubdiagram(project, diagramId, nodeId, {
        title: `${node.label} — Details`,
      });
      $project.set(updated);
      const updatedNode = updated.diagrams[diagramId].nodes.find((n) => n.id === nodeId);
      if (updatedNode?.childDiagramId) {
        targetDiagramId = updatedNode.childDiagramId;
      }
    });
    // Re-read after update
    const refreshed = $project.get()!;
    const refreshedNode = refreshed.diagrams[diagramId]?.nodes.find((n) => n.id === nodeId);
    targetDiagramId = refreshedNode?.childDiagramId;
  }

  if (!targetDiagramId) return;

  clearSelection();
  $activeDiagramId.set(targetDiagramId);
  $navigationStack.set([...$navigationStack.get(), targetDiagramId]);
  // Auto-save when entering a sub-diagram
  persistCurrentState();
}

/** Navigate back to the parent diagram. */
export function goBack(): void {
  const stack = $navigationStack.get();
  if (stack.length <= 1) return;
  const next = stack.slice(0, -1);
  $navigationStack.set(next);
  $activeDiagramId.set(next[next.length - 1]);
  clearSelection();
  // Auto-save when going back
  persistCurrentState();
}

/**
 * Build the path (list of diagram IDs from root to target) by traversing the
 * project's diagram tree. Returns null when the diagram cannot be reached.
 */
function findPathToDiagram(project: C4Project, targetId: string): string[] | null {
  const visited = new Set<string>();
  const reversePath: string[] = [];
  function dfs(diagId: string): boolean {
    if (visited.has(diagId)) return false;
    visited.add(diagId);
    reversePath.push(diagId);
    if (diagId === targetId) return true;
    const diag = project.diagrams[diagId];
    if (diag) {
      for (const node of diag.nodes) {
        if (node.childDiagramId && dfs(node.childDiagramId)) return true;
      }
    }
    reversePath.pop();
    return false;
  }
  return dfs(project.rootDiagramId) ? reversePath : null;
}

/** Jump directly to any diagram in the project by ID, rebuilding the navigation breadcrumb. */
export function jumpToDiagram(diagramId: string): void {
  const project = $project.get();
  if (!project || !project.diagrams[diagramId]) return;
  const path = findPathToDiagram(project, diagramId);
  if (!path) return;
  clearSelection();
  $navigationStack.set(path);
  $activeDiagramId.set(diagramId);
}

/** Navigate to any diagram in the breadcrumb by index. */
export function navigateTo(index: number): void {
  const stack = $navigationStack.get();
  if (index < 0 || index >= stack.length) return;
  const next = stack.slice(0, index + 1);
  $navigationStack.set(next);
  $activeDiagramId.set(next[next.length - 1]);
  clearSelection();
  // Auto-save when navigating via breadcrumb
  persistCurrentState();
}

// ---------------------------------------------------------------------------
// Persist helper
// ---------------------------------------------------------------------------

/** Save current project state to localStorage. */
export function persistCurrentState(): void {
  const project = $project.get();
  const activeDiagramId = $activeDiagramId.get();
  if (!project) return;
  saveToLocalStorage({ project, activeDiagramId: activeDiagramId ?? undefined });
}

// ---------------------------------------------------------------------------
// Undo / Redo
// ---------------------------------------------------------------------------

export function undo(): void {
  const current = $project.get();
  if (!current) return;
  const { past, future } = $history.get();
  if (past.length === 0) return;
  const prev = past[past.length - 1];
  $history.set({ past: past.slice(0, -1), future: [...future, current] });
  $project.set(prev);
}

export function redo(): void {
  const current = $project.get();
  if (!current) return;
  const { past, future } = $history.get();
  if (future.length === 0) return;
  const next = future[future.length - 1];
  $history.set({ past: [...past, current], future: future.slice(0, -1) });
  $project.set(next);
}
