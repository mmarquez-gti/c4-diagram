import { describe, it, expect, beforeEach } from 'vitest';
import {
  $project,
  $activeDiagramId,
  $navigationStack,
  createProject,
  loadProject,
  addNode,
  updateNode,
  updateNodePosition,
  removeNode,
  addEdge,
  updateEdge,
  removeEdge,
  enterSubdiagram,
  goBack,
  navigateTo,
  undo,
  redo,
} from './diagramStore';
import { $history, clearHistory } from './historyStore';
import { $selectedNodeId, $selectedEdgeId, selectNode } from './selectionStore';

beforeEach(() => {
  // Reset state before each test
  $project.set(null);
  $activeDiagramId.set(null);
  $navigationStack.set([]);
  clearHistory();
  $selectedNodeId.set(null);
  $selectedEdgeId.set(null);
});

// ---------------------------------------------------------------------------
// createProject / loadProject
// ---------------------------------------------------------------------------
describe('createProject', () => {
  it('sets $project and activeDiagramId', () => {
    createProject('Test');
    const p = $project.get();
    expect(p).not.toBeNull();
    expect(p!.name).toBe('Test');
    expect($activeDiagramId.get()).toBe(p!.rootDiagramId);
    expect($navigationStack.get()).toEqual([p!.rootDiagramId]);
  });

  it('clears history', () => {
    createProject();
    createProject();
    expect($history.get().past).toHaveLength(0);
  });
});

describe('loadProject', () => {
  it('loads an external project', () => {
    createProject('Initial');
    const initial = $project.get()!;
    createProject('Second');
    loadProject(initial);
    expect($project.get()!.name).toBe('Initial');
  });
});

// ---------------------------------------------------------------------------
// addNode
// ---------------------------------------------------------------------------
describe('addNode', () => {
  it('adds a node to the active diagram', () => {
    createProject();
    const node = addNode({ type: 'Person', label: 'Alice' });
    expect(node).not.toBeNull();
    const diagram = $project.get()!.diagrams[$activeDiagramId.get()!];
    expect(diagram.nodes.some((n) => n.id === node!.id)).toBe(true);
  });

  it('returns null when no project is loaded', () => {
    const result = addNode();
    expect(result).toBeNull();
  });

  it('saves to undo history', () => {
    createProject();
    addNode();
    expect($history.get().past.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// updateNode / updateNodePosition
// ---------------------------------------------------------------------------
describe('updateNode', () => {
  it('updates a node label', () => {
    createProject();
    const node = addNode({ label: 'Old' })!;
    updateNode(node.id, { label: 'New' });
    const diagram = $project.get()!.diagrams[$activeDiagramId.get()!];
    expect(diagram.nodes.find((n) => n.id === node.id)!.label).toBe('New');
  });
});

describe('updateNodePosition', () => {
  it('updates node position without saving a snapshot (drag should be lightweight)', () => {
    createProject();
    const node = addNode()!;
    const historyBefore = $history.get().past.length;
    updateNodePosition(node.id, 42, 99);
    const diagram = $project.get()!.diagrams[$activeDiagramId.get()!];
    expect(diagram.nodes.find((n) => n.id === node.id)!.position).toEqual({ x: 42, y: 99 });
    // Should NOT add a snapshot on every drag event
    expect($history.get().past.length).toBe(historyBefore);
  });
});

// ---------------------------------------------------------------------------
// removeNode
// ---------------------------------------------------------------------------
describe('removeNode', () => {
  it('removes a node', () => {
    createProject();
    const node = addNode()!;
    removeNode(node.id);
    const diagram = $project.get()!.diagrams[$activeDiagramId.get()!];
    expect(diagram.nodes.find((n) => n.id === node.id)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// addEdge / updateEdge / removeEdge
// ---------------------------------------------------------------------------
describe('addEdge', () => {
  it('adds an edge', () => {
    createProject();
    const n1 = addNode()!;
    const n2 = addNode()!;
    const edge = addEdge(n1.id, n2.id, 'Calls');
    expect(edge).not.toBeNull();
    const diagram = $project.get()!.diagrams[$activeDiagramId.get()!];
    expect(diagram.edges.find((e) => e.id === edge!.id)).toBeTruthy();
  });
});

describe('updateEdge', () => {
  it('updates edge label', () => {
    createProject();
    const n1 = addNode()!;
    const n2 = addNode()!;
    const edge = addEdge(n1.id, n2.id, 'Old')!;
    updateEdge(edge.id, { label: 'New' });
    const diagram = $project.get()!.diagrams[$activeDiagramId.get()!];
    expect(diagram.edges.find((e) => e.id === edge.id)!.label).toBe('New');
  });
});

describe('removeEdge', () => {
  it('removes an edge', () => {
    createProject();
    const n1 = addNode()!;
    const n2 = addNode()!;
    const edge = addEdge(n1.id, n2.id)!;
    removeEdge(edge.id);
    const diagram = $project.get()!.diagrams[$activeDiagramId.get()!];
    expect(diagram.edges.find((e) => e.id === edge.id)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// enterSubdiagram / goBack / navigateTo
// ---------------------------------------------------------------------------
describe('enterSubdiagram', () => {
  it('drills into a sub-diagram (creates it if absent)', () => {
    createProject();
    const node = addNode()!;
    const rootId = $activeDiagramId.get()!;
    enterSubdiagram(node.id);
    const newId = $activeDiagramId.get();
    expect(newId).not.toBe(rootId);
    const project = $project.get()!;
    expect(project.diagrams[newId!]).toBeTruthy();
  });

  it('increases navigation stack depth', () => {
    createProject();
    const node = addNode()!;
    const before = $navigationStack.get().length;
    enterSubdiagram(node.id);
    expect($navigationStack.get().length).toBe(before + 1);
  });
});

describe('goBack', () => {
  it('navigates back to the parent diagram', () => {
    createProject();
    const node = addNode()!;
    const rootId = $activeDiagramId.get()!;
    enterSubdiagram(node.id);
    goBack();
    expect($activeDiagramId.get()).toBe(rootId);
    expect($navigationStack.get()).toEqual([rootId]);
  });

  it('does nothing when already at root', () => {
    createProject();
    const rootId = $activeDiagramId.get()!;
    goBack();
    expect($activeDiagramId.get()).toBe(rootId);
  });
});

describe('navigateTo', () => {
  it('navigates to a diagram by breadcrumb index', () => {
    createProject();
    const node = addNode()!;
    const rootId = $activeDiagramId.get()!;
    enterSubdiagram(node.id);
    navigateTo(0);
    expect($activeDiagramId.get()).toBe(rootId);
  });
});

// ---------------------------------------------------------------------------
// undo / redo
// ---------------------------------------------------------------------------
describe('undo / redo', () => {
  it('undoes an addNode action', () => {
    createProject();
    const countBefore = $project.get()!.diagrams[$activeDiagramId.get()!].nodes.length;
    addNode();
    undo();
    const countAfter = $project.get()!.diagrams[$activeDiagramId.get()!].nodes.length;
    expect(countAfter).toBe(countBefore);
  });

  it('redoes after undo', () => {
    createProject();
    addNode();
    const countWithNode = $project.get()!.diagrams[$activeDiagramId.get()!].nodes.length;
    undo();
    redo();
    const countAfterRedo = $project.get()!.diagrams[$activeDiagramId.get()!].nodes.length;
    expect(countAfterRedo).toBe(countWithNode);
  });

  it('undo is a no-op when history is empty', () => {
    createProject();
    const p = $project.get();
    undo();
    expect($project.get()).toBe(p);
  });
});
