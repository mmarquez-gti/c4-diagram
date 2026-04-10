import { describe, it, expect } from 'vitest';
import {
  generateId,
  createNode,
  createEdge,
  createDiagram,
  createProject,
  addNodeToDiagram,
  removeNodeFromDiagram,
  updateNodeInDiagram,
  updateNodePosition,
  addEdgeToDiagram,
  removeEdgeFromDiagram,
  updateEdgeInDiagram,
  createSubdiagram,
  addNodeToProject,
  removeNodeFromProject,
  updateNodeInProject,
  addEdgeToProject,
  removeEdgeFromProject,
  MAX_DEPTH,
} from './model';
import type { C4Node, C4Edge, C4Diagram } from './types';

// ---------------------------------------------------------------------------
// generateId
// ---------------------------------------------------------------------------
describe('generateId', () => {
  it('generates unique IDs', () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
  });

  it('uses the given prefix', () => {
    expect(generateId('node')).toMatch(/^node-/);
  });
});

// ---------------------------------------------------------------------------
// createNode
// ---------------------------------------------------------------------------
describe('createNode', () => {
  it('creates a node with defaults', () => {
    const node = createNode();
    expect(node.type).toBe('System');
    expect(node.label).toBe('New System');
    expect(node.position).toEqual({ x: 100, y: 100 });
    expect(node.size).toEqual({ width: 160, height: 80 });
  });

  it('respects provided options', () => {
    const node = createNode({ type: 'Person', label: 'Alice', x: 20, y: 30 });
    expect(node.type).toBe('Person');
    expect(node.label).toBe('Alice');
    expect(node.position).toEqual({ x: 20, y: 30 });
  });
});

// ---------------------------------------------------------------------------
// createEdge
// ---------------------------------------------------------------------------
describe('createEdge', () => {
  it('creates an edge with required fields', () => {
    const edge = createEdge({ source: 'a', target: 'b' });
    expect(edge.source).toBe('a');
    expect(edge.target).toBe('b');
    expect(edge.id).toBeTruthy();
  });

  it('stores label and technology', () => {
    const edge = createEdge({ source: 'a', target: 'b', label: 'Calls', technology: 'HTTP' });
    expect(edge.label).toBe('Calls');
    expect(edge.technology).toBe('HTTP');
  });
});

// ---------------------------------------------------------------------------
// createDiagram
// ---------------------------------------------------------------------------
describe('createDiagram', () => {
  it('creates a diagram with defaults', () => {
    const d = createDiagram();
    expect(d.level).toBe('context');
    expect(d.depth).toBe(0);
    expect(d.nodes).toHaveLength(0);
    expect(d.edges).toHaveLength(0);
  });

  it('respects options', () => {
    const d = createDiagram({ title: 'My Diagram', level: 'container', depth: 2 });
    expect(d.title).toBe('My Diagram');
    expect(d.level).toBe('container');
    expect(d.depth).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// createProject
// ---------------------------------------------------------------------------
describe('createProject', () => {
  it('creates a project with a root diagram', () => {
    const p = createProject('Test');
    expect(p.name).toBe('Test');
    expect(p.rootDiagramId).toBeTruthy();
    expect(p.diagrams[p.rootDiagramId]).toBeTruthy();
  });

  it('defaults name to "New Project"', () => {
    const p = createProject();
    expect(p.name).toBe('New Project');
  });
});

// ---------------------------------------------------------------------------
// Diagram mutation helpers
// ---------------------------------------------------------------------------
describe('addNodeToDiagram', () => {
  it('appends a node', () => {
    const d = createDiagram();
    const node = createNode();
    const updated = addNodeToDiagram(d, node);
    expect(updated.nodes).toHaveLength(1);
    expect(updated.nodes[0].id).toBe(node.id);
  });

  it('does not mutate the original', () => {
    const d = createDiagram();
    addNodeToDiagram(d, createNode());
    expect(d.nodes).toHaveLength(0);
  });
});

describe('removeNodeFromDiagram', () => {
  it('removes the node', () => {
    const node = createNode();
    const d = addNodeToDiagram(createDiagram(), node);
    const updated = removeNodeFromDiagram(d, node.id);
    expect(updated.nodes).toHaveLength(0);
  });

  it('removes connected edges', () => {
    const n1 = createNode();
    const n2 = createNode();
    let d = addNodeToDiagram(createDiagram(), n1);
    d = addNodeToDiagram(d, n2);
    const edge = createEdge({ source: n1.id, target: n2.id });
    d = addEdgeToDiagram(d, edge);
    const updated = removeNodeFromDiagram(d, n1.id);
    expect(updated.edges).toHaveLength(0);
  });
});

describe('updateNodeInDiagram', () => {
  it('updates specified fields', () => {
    const node = createNode({ label: 'Old' });
    const d = addNodeToDiagram(createDiagram(), node);
    const updated = updateNodeInDiagram(d, node.id, { label: 'New' });
    expect(updated.nodes[0].label).toBe('New');
  });
});

describe('updateNodePosition', () => {
  it('updates position', () => {
    const node = createNode();
    const d = addNodeToDiagram(createDiagram(), node);
    const updated = updateNodePosition(d, node.id, 42, 99);
    expect(updated.nodes[0].position).toEqual({ x: 42, y: 99 });
  });
});

describe('addEdgeToDiagram / removeEdgeFromDiagram / updateEdgeInDiagram', () => {
  it('add/remove/update an edge', () => {
    let d = createDiagram();
    const edge = createEdge({ source: 'a', target: 'b', label: 'Old' });
    d = addEdgeToDiagram(d, edge);
    expect(d.edges).toHaveLength(1);

    d = updateEdgeInDiagram(d, edge.id, { label: 'New' });
    expect(d.edges[0].label).toBe('New');

    d = removeEdgeFromDiagram(d, edge.id);
    expect(d.edges).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// createSubdiagram
// ---------------------------------------------------------------------------
describe('createSubdiagram', () => {
  it('creates a child diagram and wires childDiagramId', () => {
    let project = createProject();
    const rootId = project.rootDiagramId;
    const node = createNode({ label: 'API' });
    project = addNodeToProject(project, rootId, node);

    const updated = createSubdiagram(project, rootId, node.id, { title: 'API Detail' });
    const parentNode = updated.diagrams[rootId].nodes.find((n) => n.id === node.id)!;
    expect(parentNode.childDiagramId).toBeTruthy();
    expect(updated.diagrams[parentNode.childDiagramId!]).toBeTruthy();
    expect(updated.diagrams[parentNode.childDiagramId!].title).toBe('API Detail');
  });

  it('throws when parent diagram does not exist', () => {
    const project = createProject();
    expect(() => createSubdiagram(project, 'nonexistent', 'nodeId')).toThrow();
  });

  it('throws when node does not exist', () => {
    const project = createProject();
    expect(() => createSubdiagram(project, project.rootDiagramId, 'nonexistent')).toThrow();
  });

  it(`throws when depth would exceed MAX_DEPTH (${MAX_DEPTH})`, () => {
    let project = createProject();
    let currentDiagId = project.rootDiagramId;

    for (let i = 0; i < MAX_DEPTH; i++) {
      const node = createNode({ label: `Node ${i}` });
      project = addNodeToProject(project, currentDiagId, node);
      project = createSubdiagram(project, currentDiagId, node.id);
      const updatedNode = project.diagrams[currentDiagId].nodes.find((n) => n.id === node.id)!;
      currentDiagId = updatedNode.childDiagramId!;
    }

    // currentDiagId is now at depth MAX_DEPTH — one more level should throw
    const node = createNode({ label: 'Too deep' });
    project = addNodeToProject(project, currentDiagId, node);
    expect(() => createSubdiagram(project, currentDiagId, node.id)).toThrow(/depth/i);
  });
});

// ---------------------------------------------------------------------------
// Project-level mutation helpers
// ---------------------------------------------------------------------------
describe('project-level helpers', () => {
  it('addNodeToProject / removeNodeFromProject', () => {
    const p = createProject();
    const node = createNode();
    const withNode = addNodeToProject(p, p.rootDiagramId, node);
    expect(withNode.diagrams[p.rootDiagramId].nodes).toHaveLength(1);

    const without = removeNodeFromProject(withNode, p.rootDiagramId, node.id);
    expect(without.diagrams[p.rootDiagramId].nodes).toHaveLength(0);
  });

  it('updateNodeInProject', () => {
    const p = createProject();
    const node = createNode({ label: 'Old' });
    const withNode = addNodeToProject(p, p.rootDiagramId, node);
    const updated = updateNodeInProject(withNode, p.rootDiagramId, node.id, { label: 'New' });
    expect(updated.diagrams[p.rootDiagramId].nodes[0].label).toBe('New');
  });

  it('addEdgeToProject / removeEdgeFromProject', () => {
    const p = createProject();
    const n1 = createNode();
    const n2 = createNode();
    let proj = addNodeToProject(p, p.rootDiagramId, n1);
    proj = addNodeToProject(proj, p.rootDiagramId, n2);
    const edge = createEdge({ source: n1.id, target: n2.id });
    proj = addEdgeToProject(proj, p.rootDiagramId, edge);
    expect(proj.diagrams[p.rootDiagramId].edges).toHaveLength(1);
    proj = removeEdgeFromProject(proj, p.rootDiagramId, edge.id);
    expect(proj.diagrams[p.rootDiagramId].edges).toHaveLength(0);
  });

  it('returns project unchanged when diagramId is unknown', () => {
    const p = createProject();
    const node = createNode();
    const result = addNodeToProject(p, 'nonexistent', node);
    expect(result).toBe(p);
  });
});
