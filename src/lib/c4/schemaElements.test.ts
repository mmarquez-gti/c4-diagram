/**
 * Schema element tests — validates every C4 node type, every edge direction,
 * all node visual properties, and the batch mutation helpers.
 */

import { describe, it, expect } from 'vitest';
import type { C4NodeType } from './types';
import {
  createNode,
  createEdge,
  createDiagram,
  createProject,
  addNodeToDiagram,
  addEdgeToDiagram,
  removeMultipleFromDiagram,
  addMultipleToDiagram,
  removeMultipleFromProject,
  addMultipleToProject,
  updateEdgeInProject,
} from './model';

// ---------------------------------------------------------------------------
// All C4 node types
// ---------------------------------------------------------------------------

const ALL_NODE_TYPES: C4NodeType[] = [
  'Person',
  'System',
  'SystemExt',
  'Boundary',
  'Container',
  'ContainerDb',
  'Component',
  'TextLabel',
  'GroupBox',
];

describe('createNode — all C4 node types', () => {
  for (const type of ALL_NODE_TYPES) {
    it(`creates a ${type} node with correct type`, () => {
      const node = createNode({ type });
      expect(node.type).toBe(type);
      expect(node.id).toMatch(/^node-/);
    });
  }

  it('all node types have unique IDs', () => {
    const ids = ALL_NODE_TYPES.map((type) => createNode({ type }).id);
    expect(new Set(ids).size).toBe(ALL_NODE_TYPES.length);
  });
});

// ---------------------------------------------------------------------------
// Node default sizes per type
// ---------------------------------------------------------------------------

describe('createNode — default size and position', () => {
  it('defaults position to (100, 100)', () => {
    expect(createNode().position).toEqual({ x: 100, y: 100 });
  });

  it('accepts custom x/y coordinates', () => {
    const node = createNode({ x: 250, y: 400 });
    expect(node.position).toEqual({ x: 250, y: 400 });
  });

  it('accepts custom width and height', () => {
    const node = createNode({ width: 200, height: 120 });
    expect(node.size).toEqual({ width: 200, height: 120 });
  });
});

// ---------------------------------------------------------------------------
// Node visual / optional properties
// ---------------------------------------------------------------------------

describe('createNode — optional / visual properties', () => {
  it('stores description', () => {
    const node = createNode({ description: 'A backend service' });
    expect(node.description).toBe('A backend service');
  });

  it('stores technology', () => {
    const node = createNode({ technology: 'Java' });
    expect(node.technology).toBe('Java');
  });

  it('color, textColor, hideIcon, hideTypeLabel can be set via spread', () => {
    const base = createNode({ type: 'System', label: 'Styled System' });
    const styled = {
      ...base,
      color: '#1abc9c',
      textColor: '#000000',
      hideIcon: true,
      hideTypeLabel: false,
    };
    expect(styled.color).toBe('#1abc9c');
    expect(styled.textColor).toBe('#000000');
    expect(styled.hideIcon).toBe(true);
    expect(styled.hideTypeLabel).toBe(false);
  });

  it('childDiagramId can be set on a node', () => {
    const node = { ...createNode(), childDiagramId: 'diag-child-1' };
    expect(node.childDiagramId).toBe('diag-child-1');
  });
});

// ---------------------------------------------------------------------------
// Edge direction variants
// ---------------------------------------------------------------------------

describe('createEdge — direction variants', () => {
  it('stores direction: forward', () => {
    const e = createEdge({ source: 'a', target: 'b', direction: 'forward' });
    expect(e.direction).toBe('forward');
  });

  it('stores direction: reverse', () => {
    const e = createEdge({ source: 'a', target: 'b', direction: 'reverse' });
    expect(e.direction).toBe('reverse');
  });

  it('stores direction: bidirectional', () => {
    const e = createEdge({ source: 'a', target: 'b', direction: 'bidirectional' });
    expect(e.direction).toBe('bidirectional');
  });

  it('stores direction: none', () => {
    const e = createEdge({ source: 'a', target: 'b', direction: 'none' });
    expect(e.direction).toBe('none');
  });

  it('direction is undefined when not provided', () => {
    const e = createEdge({ source: 'a', target: 'b' });
    expect(e.direction).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Edge path modes
// ---------------------------------------------------------------------------

describe('createEdge — path modes', () => {
  it('stores pathMode: bezier', () => {
    expect(createEdge({ source: 'a', target: 'b', pathMode: 'bezier' }).pathMode).toBe('bezier');
  });

  it('stores pathMode: straight', () => {
    expect(createEdge({ source: 'a', target: 'b', pathMode: 'straight' }).pathMode).toBe('straight');
  });

  it('stores pathMode: orthogonal', () => {
    expect(createEdge({ source: 'a', target: 'b', pathMode: 'orthogonal' }).pathMode).toBe('orthogonal');
  });
});

// ---------------------------------------------------------------------------
// Edge bend points and label offsets
// ---------------------------------------------------------------------------

describe('createEdge — bend points and label offsets', () => {
  it('stores multiple bend points', () => {
    const bps = [{ x: 10, y: 20 }, { x: 30, y: 40 }, { x: 50, y: 60 }];
    const e = createEdge({ source: 'a', target: 'b', bendPoints: bps });
    expect(e.bendPoints).toEqual(bps);
    expect(e.bendPoints!).toHaveLength(3);
  });

  it('stores positive and negative label offsets', () => {
    const e = createEdge({ source: 'a', target: 'b', labelOffsetX: 15, labelOffsetY: -10 });
    expect(e.labelOffsetX).toBe(15);
    expect(e.labelOffsetY).toBe(-10);
  });

  it('stores zero label offsets', () => {
    const e = createEdge({ source: 'a', target: 'b', labelOffsetX: 0, labelOffsetY: 0 });
    expect(e.labelOffsetX).toBe(0);
    expect(e.labelOffsetY).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Batch diagram operations — removeMultipleFromDiagram
// ---------------------------------------------------------------------------

describe('removeMultipleFromDiagram', () => {
  it('removes multiple nodes at once', () => {
    const n1 = createNode({ label: 'N1' });
    const n2 = createNode({ label: 'N2' });
    const n3 = createNode({ label: 'N3' });
    let d = createDiagram();
    d = addNodeToDiagram(d, n1);
    d = addNodeToDiagram(d, n2);
    d = addNodeToDiagram(d, n3);

    const result = removeMultipleFromDiagram(d, [n1.id, n2.id], []);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe(n3.id);
  });

  it('removes specified edges', () => {
    const n1 = createNode();
    const n2 = createNode();
    let d = createDiagram();
    d = addNodeToDiagram(d, n1);
    d = addNodeToDiagram(d, n2);
    const e1 = createEdge({ source: n1.id, target: n2.id, label: 'E1' });
    const e2 = createEdge({ source: n2.id, target: n1.id, label: 'E2' });
    d = addEdgeToDiagram(d, e1);
    d = addEdgeToDiagram(d, e2);

    const result = removeMultipleFromDiagram(d, [], [e1.id]);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].id).toBe(e2.id);
  });

  it('removes edges connected to removed nodes (even if not listed in edgeIds)', () => {
    const n1 = createNode();
    const n2 = createNode();
    let d = createDiagram();
    d = addNodeToDiagram(d, n1);
    d = addNodeToDiagram(d, n2);
    const edge = createEdge({ source: n1.id, target: n2.id });
    d = addEdgeToDiagram(d, edge);

    const result = removeMultipleFromDiagram(d, [n1.id], []);
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0); // edge removed because source was removed
  });

  it('does not mutate the original diagram', () => {
    const n1 = createNode();
    let d = createDiagram();
    d = addNodeToDiagram(d, n1);
    const originalNodeCount = d.nodes.length;

    removeMultipleFromDiagram(d, [n1.id], []);
    expect(d.nodes).toHaveLength(originalNodeCount);
  });

  it('is a no-op when ids are empty', () => {
    const n1 = createNode();
    let d = createDiagram();
    d = addNodeToDiagram(d, n1);

    const result = removeMultipleFromDiagram(d, [], []);
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Batch diagram operations — addMultipleToDiagram
// ---------------------------------------------------------------------------

describe('addMultipleToDiagram', () => {
  it('adds multiple nodes at once', () => {
    const n1 = createNode({ label: 'A' });
    const n2 = createNode({ label: 'B' });
    const d = createDiagram();

    const result = addMultipleToDiagram(d, [n1, n2], []);
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes.map((n) => n.label)).toContain('A');
    expect(result.nodes.map((n) => n.label)).toContain('B');
  });

  it('adds multiple edges at once', () => {
    const n1 = createNode();
    const n2 = createNode();
    let d = createDiagram();
    d = addMultipleToDiagram(d, [n1, n2], []);

    const e1 = createEdge({ source: n1.id, target: n2.id });
    const e2 = createEdge({ source: n2.id, target: n1.id });
    const result = addMultipleToDiagram(d, [], [e1, e2]);
    expect(result.edges).toHaveLength(2);
  });

  it('does not mutate the original diagram', () => {
    const d = createDiagram();
    const n1 = createNode();

    addMultipleToDiagram(d, [n1], []);
    expect(d.nodes).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Project-level batch operations
// ---------------------------------------------------------------------------

describe('removeMultipleFromProject', () => {
  it('removes nodes and edges in one operation', () => {
    let project = createProject();
    const n1 = createNode({ label: 'Keep' });
    const n2 = createNode({ label: 'Remove' });
    project = addMultipleToProject(project, project.rootDiagramId, [n1, n2], []);
    const edge = createEdge({ source: n1.id, target: n2.id });
    project = { ...project, diagrams: { ...project.diagrams, [project.rootDiagramId]: addEdgeToDiagram(project.diagrams[project.rootDiagramId], edge) } };

    project = removeMultipleFromProject(project, project.rootDiagramId, [n2.id], []);

    const diag = project.diagrams[project.rootDiagramId];
    expect(diag.nodes).toHaveLength(1);
    expect(diag.nodes[0].label).toBe('Keep');
    expect(diag.edges).toHaveLength(0); // edge removed because target was removed
  });

  it('returns project unchanged when diagramId is unknown', () => {
    const project = createProject();
    const result = removeMultipleFromProject(project, 'nonexistent', ['n1'], []);
    expect(result).toBe(project);
  });
});

describe('addMultipleToProject', () => {
  it('adds nodes and edges in one operation', () => {
    let project = createProject();
    const n1 = createNode({ label: 'X' });
    const n2 = createNode({ label: 'Y' });
    const edge = createEdge({ source: n1.id, target: n2.id });

    project = addMultipleToProject(project, project.rootDiagramId, [n1, n2], [edge]);

    const diag = project.diagrams[project.rootDiagramId];
    expect(diag.nodes).toHaveLength(2);
    expect(diag.edges).toHaveLength(1);
  });

  it('returns project unchanged when diagramId is unknown', () => {
    const project = createProject();
    const result = addMultipleToProject(project, 'nonexistent', [], []);
    expect(result).toBe(project);
  });
});

// ---------------------------------------------------------------------------
// updateEdgeInProject
// ---------------------------------------------------------------------------

describe('updateEdgeInProject', () => {
  it('updates an edge label', () => {
    let project = createProject();
    const n1 = createNode();
    const n2 = createNode();
    project = addMultipleToProject(project, project.rootDiagramId, [n1, n2], []);
    const edge = createEdge({ source: n1.id, target: n2.id, label: 'Old Label' });
    project = { ...project, diagrams: { ...project.diagrams, [project.rootDiagramId]: addEdgeToDiagram(project.diagrams[project.rootDiagramId], edge) } };

    project = updateEdgeInProject(project, project.rootDiagramId, edge.id, { label: 'New Label' });
    const diag = project.diagrams[project.rootDiagramId];
    expect(diag.edges[0].label).toBe('New Label');
  });

  it('updates edge pathMode', () => {
    let project = createProject();
    const n1 = createNode();
    const n2 = createNode();
    project = addMultipleToProject(project, project.rootDiagramId, [n1, n2], []);
    const edge = createEdge({ source: n1.id, target: n2.id, pathMode: 'bezier' });
    project = { ...project, diagrams: { ...project.diagrams, [project.rootDiagramId]: addEdgeToDiagram(project.diagrams[project.rootDiagramId], edge) } };

    project = updateEdgeInProject(project, project.rootDiagramId, edge.id, { pathMode: 'straight' });
    expect(project.diagrams[project.rootDiagramId].edges[0].pathMode).toBe('straight');
  });

  it('returns project unchanged when diagramId is unknown', () => {
    const project = createProject();
    const result = updateEdgeInProject(project, 'nonexistent', 'e1', { label: 'X' });
    expect(result).toBe(project);
  });
});

// ---------------------------------------------------------------------------
// Full schema element round-trip through a project
// ---------------------------------------------------------------------------

describe('full schema round-trip — one node of each type in a project', () => {
  it('stores and retrieves every node type from a project', () => {
    let project = createProject('Schema Round Trip');

    ALL_NODE_TYPES.forEach((type, i) => {
      const node = createNode({ type, label: `${type} Label`, x: i * 100, y: 0 });
      project = addMultipleToProject(project, project.rootDiagramId, [node], []);
    });

    const diag = project.diagrams[project.rootDiagramId];
    expect(diag.nodes).toHaveLength(ALL_NODE_TYPES.length);

    ALL_NODE_TYPES.forEach((type) => {
      expect(diag.nodes.some((n) => n.type === type)).toBe(true);
    });
  });

  it('stores and retrieves all edge directions in a single diagram', () => {
    let project = createProject('Edge Types Round Trip');
    const n1 = createNode({ label: 'Source' });
    const n2 = createNode({ label: 'Target' });
    project = addMultipleToProject(project, project.rootDiagramId, [n1, n2], []);

    const directions = ['forward', 'reverse', 'bidirectional', 'none'] as const;
    const edges = directions.map((dir) =>
      createEdge({ source: n1.id, target: n2.id, direction: dir }),
    );
    project = addMultipleToProject(project, project.rootDiagramId, [], edges);

    const diag = project.diagrams[project.rootDiagramId];
    expect(diag.edges).toHaveLength(4);
    directions.forEach((dir) => {
      expect(diag.edges.some((e) => e.direction === dir)).toBe(true);
    });
  });
});
