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
  updateNodeSize,
  removeNode,
  addEdge,
  updateEdge,
  removeEdge,
  enterSubdiagram,
  goBack,
  navigateTo,
  jumpToDiagram,
  undo,
  redo,
  removeMultiple,
  pasteItems,
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

// ---------------------------------------------------------------------------
// updateNodeSize
// ---------------------------------------------------------------------------
describe('updateNodeSize', () => {
  it('updates node size without saving to history', () => {
    createProject();
    const node = addNode()!;
    const historyBefore = $history.get().past.length;
    updateNodeSize(node.id, 300, 150);
    const diagram = $project.get()!.diagrams[$activeDiagramId.get()!];
    expect(diagram.nodes.find((n) => n.id === node.id)!.size).toEqual({ width: 300, height: 150 });
    expect($history.get().past.length).toBe(historyBefore);
  });

  it('is a no-op when no project is loaded', () => {
    // $project is null — should not throw
    expect(() => updateNodeSize('ghost', 100, 100)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// removeMultiple
// ---------------------------------------------------------------------------
describe('removeMultiple', () => {
  it('removes multiple nodes in one history snapshot', () => {
    createProject();
    const n1 = addNode({ label: 'A' })!;
    const n2 = addNode({ label: 'B' })!;
    const n3 = addNode({ label: 'C' })!;
    const historyBefore = $history.get().past.length;

    removeMultiple([n1.id, n2.id], []);

    const diagram = $project.get()!.diagrams[$activeDiagramId.get()!];
    expect(diagram.nodes).toHaveLength(1);
    expect(diagram.nodes[0].id).toBe(n3.id);
    // Only one history snapshot for the batch operation
    expect($history.get().past.length).toBe(historyBefore + 1);
  });

  it('removes multiple edges in one history snapshot', () => {
    createProject();
    const n1 = addNode()!;
    const n2 = addNode()!;
    const e1 = addEdge(n1.id, n2.id)!;
    const e2 = addEdge(n2.id, n1.id)!;

    removeMultiple([], [e1.id, e2.id]);

    const diagram = $project.get()!.diagrams[$activeDiagramId.get()!];
    expect(diagram.edges).toHaveLength(0);
  });

  it('is a no-op when both arrays are empty', () => {
    createProject();
    addNode();
    const historyBefore = $history.get().past.length;
    removeMultiple([], []);
    expect($history.get().past.length).toBe(historyBefore);
  });

  it('is a no-op when no project is loaded', () => {
    expect(() => removeMultiple(['n1'], [])).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// pasteItems
// ---------------------------------------------------------------------------
describe('pasteItems', () => {
  it('pastes nodes with offset positions and new IDs', () => {
    createProject();
    const original = addNode({ label: 'Original', x: 100, y: 100 })!;
    const historyBefore = $history.get().past.length;

    pasteItems([{ ...original }], [], 20, 30);

    const diagram = $project.get()!.diagrams[$activeDiagramId.get()!];
    expect(diagram.nodes).toHaveLength(2);

    const pasted = diagram.nodes.find((n) => n.id !== original.id)!;
    expect(pasted.label).toBe('Original');
    expect(pasted.position).toEqual({ x: 120, y: 130 });
    expect(pasted.id).not.toBe(original.id);
    // One history snapshot
    expect($history.get().past.length).toBe(historyBefore + 1);
  });

  it('does not clone childDiagramId when pasting', () => {
    createProject();
    const node = addNode()!;
    enterSubdiagram(node.id);
    goBack();

    const project = $project.get()!;
    const nodeWithChild = project.diagrams[$activeDiagramId.get()!].nodes.find((n) => n.id === node.id)!;
    expect(nodeWithChild.childDiagramId).toBeTruthy();

    pasteItems([nodeWithChild], [], 20, 20);

    const diagram = $project.get()!.diagrams[$activeDiagramId.get()!];
    const pasted = diagram.nodes.find((n) => n.id !== node.id)!;
    expect(pasted.childDiagramId).toBeUndefined();
  });

  it('only includes edges where both endpoints are in the pasted set', () => {
    createProject();
    const n1 = addNode({ label: 'N1' })!;
    const n2 = addNode({ label: 'N2' })!;
    const n3 = addNode({ label: 'N3' })!;
    const e_in = addEdge(n1.id, n2.id, undefined, undefined, 'In-selection')!;
    const e_out = addEdge(n2.id, n3.id, undefined, undefined, 'Out-selection')!;

    // Only paste n1 and n2, and both their edges — but e_out references n3 which is not pasted
    pasteItems([n1, n2], [e_in, e_out], 50, 50);

    const diagram = $project.get()!.diagrams[$activeDiagramId.get()!];
    // Original 3 nodes + 2 pasted = 5 nodes
    expect(diagram.nodes).toHaveLength(5);
    // Original 2 edges + 1 pasted (only e_in remapped) = 3 edges
    expect(diagram.edges).toHaveLength(3);

    const pastedEdge = diagram.edges.find((e) => e.label === 'In-selection' && !e.id.includes(e_in.id));
    expect(pastedEdge).toBeTruthy();
  });

  it('is a no-op when both arrays are empty', () => {
    createProject();
    addNode();
    const historyBefore = $history.get().past.length;
    pasteItems([], []);
    expect($history.get().past.length).toBe(historyBefore);
  });

  it('is a no-op when no project is loaded', () => {
    expect(() => pasteItems([{ id: 'n1', type: 'System', label: 'X', position: { x: 0, y: 0 }, size: { width: 100, height: 50 } }], [])).not.toThrow();
  });

  it('generates unique IDs for each pasted node', () => {
    createProject();
    const node = addNode()!;
    pasteItems([node], [], 10, 10);
    pasteItems([node], [], 20, 20);

    const diagram = $project.get()!.diagrams[$activeDiagramId.get()!];
    const ids = diagram.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length); // all unique
  });
});

// ---------------------------------------------------------------------------
// jumpToDiagram
// ---------------------------------------------------------------------------
describe('jumpToDiagram', () => {
  it('navigates directly to a nested diagram and rebuilds the stack', () => {
    createProject();
    const node = addNode()!;
    const rootId = $activeDiagramId.get()!;

    enterSubdiagram(node.id);
    const subDiagId = $activeDiagramId.get()!;

    // Jump back to root via jumpToDiagram
    jumpToDiagram(rootId);
    expect($activeDiagramId.get()).toBe(rootId);
    expect($navigationStack.get()).toEqual([rootId]);

    // Jump back to sub-diagram directly
    jumpToDiagram(subDiagId);
    expect($activeDiagramId.get()).toBe(subDiagId);
    expect($navigationStack.get()).toEqual([rootId, subDiagId]);
  });

  it('is a no-op when diagram does not exist in project', () => {
    createProject();
    const rootId = $activeDiagramId.get()!;
    jumpToDiagram('nonexistent-diag');
    expect($activeDiagramId.get()).toBe(rootId);
  });

  it('is a no-op when no project is loaded', () => {
    expect(() => jumpToDiagram('any')).not.toThrow();
  });
});
