import { describe, it, expect } from 'vitest';
import {
  validateReferences,
  validateDepth,
  validateProject,
  wouldCreateCycle,
} from './validation';
import {
  createProject,
  createNode,
  createEdge,
  addNodeToProject,
  addEdgeToProject,
  createSubdiagram,
  MAX_DEPTH,
} from './model';
import type { C4Project } from './types';

// ---------------------------------------------------------------------------
// validateReferences
// ---------------------------------------------------------------------------
describe('validateReferences', () => {
  it('passes for a valid project', () => {
    const p = createProject();
    expect(validateReferences(p).valid).toBe(true);
  });

  it('flags an edge with unknown source', () => {
    let p = createProject();
    const node = createNode();
    p = addNodeToProject(p, p.rootDiagramId, node);
    const edge = createEdge({ source: 'ghost', target: node.id });
    p = addEdgeToProject(p, p.rootDiagramId, edge);
    const result = validateReferences(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('ghost'))).toBe(true);
  });

  it('flags an edge with unknown target', () => {
    let p = createProject();
    const node = createNode();
    p = addNodeToProject(p, p.rootDiagramId, node);
    const edge = createEdge({ source: node.id, target: 'ghost' });
    p = addEdgeToProject(p, p.rootDiagramId, edge);
    const result = validateReferences(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('ghost'))).toBe(true);
  });

  it('flags a node referencing a missing childDiagram', () => {
    let p = createProject();
    const node = createNode();
    // Manually set childDiagramId to a non-existent diagram
    const nodeWithChild = { ...node, childDiagramId: 'missing-diag' };
    p = addNodeToProject(p, p.rootDiagramId, nodeWithChild);
    const result = validateReferences(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('missing-diag'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateDepth
// ---------------------------------------------------------------------------
describe('validateDepth', () => {
  it('passes for a diagram at depth 0', () => {
    const p = createProject();
    const diagram = p.diagrams[p.rootDiagramId];
    expect(validateDepth(diagram).valid).toBe(true);
  });

  it('fails for a diagram exceeding MAX_DEPTH', () => {
    const p = createProject();
    const diagram = { ...p.diagrams[p.rootDiagramId], depth: MAX_DEPTH + 1 };
    expect(validateDepth(diagram).valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// wouldCreateCycle
// ---------------------------------------------------------------------------
describe('wouldCreateCycle', () => {
  it('returns false when no cycle exists', () => {
    const p = createProject();
    expect(wouldCreateCycle(p, p.rootDiagramId, 'child-diag')).toBe(false);
  });

  it('returns true when diagramId === childId', () => {
    const p = createProject();
    expect(wouldCreateCycle(p, p.rootDiagramId, p.rootDiagramId)).toBe(true);
  });

  it('returns true for indirect cycle', () => {
    let p = createProject();
    // Create: root → child1 → child2
    const nodeA = createNode({ label: 'A' });
    p = addNodeToProject(p, p.rootDiagramId, nodeA);
    p = createSubdiagram(p, p.rootDiagramId, nodeA.id, { title: 'Child1' });
    const updatedNodeA = p.diagrams[p.rootDiagramId].nodes.find((n) => n.id === nodeA.id)!;
    const child1Id = updatedNodeA.childDiagramId!;

    const nodeB = createNode({ label: 'B' });
    p = addNodeToProject(p, child1Id, nodeB);
    p = createSubdiagram(p, child1Id, nodeB.id, { title: 'Child2' });
    const updatedNodeB = p.diagrams[child1Id].nodes.find((n) => n.id === nodeB.id)!;
    const child2Id = updatedNodeB.childDiagramId!;

    // Adding child2 → root would be a cycle
    expect(wouldCreateCycle(p, child2Id, p.rootDiagramId)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateProject
// ---------------------------------------------------------------------------
describe('validateProject', () => {
  it('passes for a freshly created project', () => {
    const p = createProject();
    expect(validateProject(p).valid).toBe(true);
  });

  it('fails when root diagram is missing', () => {
    const p: C4Project = {
      id: 'p1',
      name: 'Test',
      rootDiagramId: 'nonexistent',
      diagrams: {},
      version: '1',
    };
    const result = validateProject(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('nonexistent'))).toBe(true);
  });
});
