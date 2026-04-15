/**
 * Comprehensive URL sharing tests.
 *
 * These tests verify the copy / paste URL workflow end-to-end:
 *   1. Build a rich project (all node types, various edge properties, sub-diagrams).
 *   2. Serialize it to a share URL hash.
 *   3. Deserialize the hash and confirm every field is faithfully restored.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  serializeStateToHash,
  deserializeStateFromHash,
  buildShareUrl,
  type UrlStateSnapshot,
} from './urlState';
import {
  createProject,
  createNode,
  createEdge,
  addNodeToProject,
  addEdgeToProject,
  createSubdiagram,
} from './c4/model';
import type { C4NodeType } from './c4/types';

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a project that contains one of every C4 node type. */
function buildAllNodeTypesProject(): ReturnType<typeof createProject> {
  let project = createProject('All Node Types');

  const nodeTypes: C4NodeType[] = [
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

  nodeTypes.forEach((type, i) => {
    const node = createNode({
      type,
      label: `${type} Node`,
      description: `Desc for ${type}`,
      technology: type === 'TextLabel' || type === 'GroupBox' ? undefined : 'Node.js',
      x: i * 200,
      y: 100,
    });
    project = addNodeToProject(project, project.rootDiagramId, node);
  });

  return project;
}

/** Build a project with every edge direction and all edge styling options. */
function buildFullEdgeProject(): ReturnType<typeof createProject> {
  let project = createProject('Full Edge Test');
  const n1 = createNode({ type: 'Person', label: 'User' });
  const n2 = createNode({ type: 'System', label: 'System' });
  const n3 = createNode({ type: 'Container', label: 'Container' });
  project = addNodeToProject(project, project.rootDiagramId, n1);
  project = addNodeToProject(project, project.rootDiagramId, n2);
  project = addNodeToProject(project, project.rootDiagramId, n3);

  const edgeForward = createEdge({ source: n1.id, target: n2.id, direction: 'forward', label: 'Forward', technology: 'HTTPS', pathMode: 'bezier' });
  const edgeReverse = createEdge({ source: n2.id, target: n1.id, direction: 'reverse', label: 'Reverse', pathMode: 'straight' });
  const edgeBidi = createEdge({ source: n1.id, target: n3.id, direction: 'bidirectional', label: 'Bidi', pathMode: 'orthogonal', labelOffsetX: 10, labelOffsetY: -5, bendPoints: [{ x: 50, y: 60 }] });
  const edgeNone = createEdge({ source: n2.id, target: n3.id, direction: 'none' });

  project = addEdgeToProject(project, project.rootDiagramId, edgeForward);
  project = addEdgeToProject(project, project.rootDiagramId, edgeReverse);
  project = addEdgeToProject(project, project.rootDiagramId, edgeBidi);
  project = addEdgeToProject(project, project.rootDiagramId, edgeNone);

  return project;
}

/** Build a project with a two-level subdiagram hierarchy. */
function buildSubdiagramProject(): ReturnType<typeof createProject> {
  let project = createProject('Subdiagram Test');
  const rootDiagId = project.rootDiagramId;

  const sysNode = createNode({ type: 'System', label: 'Main System' });
  project = addNodeToProject(project, rootDiagId, sysNode);

  // Create level-1 sub-diagram for sysNode
  project = createSubdiagram(project, rootDiagId, sysNode.id, { title: 'Container Level' });
  const updatedSys = project.diagrams[rootDiagId].nodes.find((n) => n.id === sysNode.id)!;
  const containerDiagId = updatedSys.childDiagramId!;

  // Add a container in the child diagram
  const containerNode = createNode({ type: 'Container', label: 'API Service' });
  project = addNodeToProject(project, containerDiagId, containerNode);

  // Create level-2 sub-diagram
  project = createSubdiagram(project, containerDiagId, containerNode.id, { title: 'Component Level' });

  return project;
}

// ---------------------------------------------------------------------------
// Basic URL round-trip (all node types)
// ---------------------------------------------------------------------------

describe('URL sharing — all node types round-trip', () => {
  it('serializes and restores a project with every C4 node type', () => {
    const project = buildAllNodeTypesProject();
    const snapshot: UrlStateSnapshot = {
      project,
      activeDiagramId: project.rootDiagramId,
    };

    const hash = serializeStateToHash(snapshot);
    expect(hash).toMatch(/^#share=/);

    const restored = deserializeStateFromHash(hash);
    expect(restored).not.toBeNull();

    const restoredDiag = restored!.project.diagrams[project.rootDiagramId];
    expect(restoredDiag.nodes).toHaveLength(9); // one per node type

    const types = restoredDiag.nodes.map((n) => n.type);
    expect(types).toContain('Person');
    expect(types).toContain('System');
    expect(types).toContain('SystemExt');
    expect(types).toContain('Boundary');
    expect(types).toContain('Container');
    expect(types).toContain('ContainerDb');
    expect(types).toContain('Component');
    expect(types).toContain('TextLabel');
    expect(types).toContain('GroupBox');
  });

  it('preserves node labels and descriptions after URL round-trip', () => {
    const project = buildAllNodeTypesProject();
    const hash = serializeStateToHash({ project, activeDiagramId: project.rootDiagramId });
    const restored = deserializeStateFromHash(hash)!;

    const nodes = restored.project.diagrams[project.rootDiagramId].nodes;
    const personNode = nodes.find((n) => n.type === 'Person')!;
    expect(personNode.label).toBe('Person Node');
    expect(personNode.description).toBe('Desc for Person');
    expect(personNode.technology).toBe('Node.js');
  });

  it('preserves node positions after URL round-trip', () => {
    const project = buildAllNodeTypesProject();
    const hash = serializeStateToHash({ project, activeDiagramId: project.rootDiagramId });
    const restored = deserializeStateFromHash(hash)!;

    const nodes = restored.project.diagrams[project.rootDiagramId].nodes;
    // Node positions were assigned as (i * 200, 100)
    expect(nodes[0].position).toEqual({ x: 0, y: 100 });
    expect(nodes[1].position).toEqual({ x: 200, y: 100 });
  });
});

// ---------------------------------------------------------------------------
// URL round-trip — edge properties
// ---------------------------------------------------------------------------

describe('URL sharing — edge properties round-trip', () => {
  it('restores all four edge direction types', () => {
    const project = buildFullEdgeProject();
    const hash = serializeStateToHash({ project, activeDiagramId: project.rootDiagramId });
    const restored = deserializeStateFromHash(hash)!;

    const edges = restored.project.diagrams[project.rootDiagramId].edges;
    const directions = edges.map((e) => e.direction);
    expect(directions).toContain('forward');
    expect(directions).toContain('reverse');
    expect(directions).toContain('bidirectional');
    expect(directions).toContain('none');
  });

  it('restores all three edge path modes', () => {
    const project = buildFullEdgeProject();
    const hash = serializeStateToHash({ project, activeDiagramId: project.rootDiagramId });
    const restored = deserializeStateFromHash(hash)!;

    const edges = restored.project.diagrams[project.rootDiagramId].edges;
    const pathModes = edges.map((e) => e.pathMode).filter(Boolean);
    expect(pathModes).toContain('bezier');
    expect(pathModes).toContain('straight');
    expect(pathModes).toContain('orthogonal');
  });

  it('restores edge bendPoints, labelOffsetX, labelOffsetY', () => {
    const project = buildFullEdgeProject();
    const hash = serializeStateToHash({ project, activeDiagramId: project.rootDiagramId });
    const restored = deserializeStateFromHash(hash)!;

    const edges = restored.project.diagrams[project.rootDiagramId].edges;
    const bidiEdge = edges.find((e) => e.direction === 'bidirectional')!;
    expect(bidiEdge.bendPoints).toEqual([{ x: 50, y: 60 }]);
    expect(bidiEdge.labelOffsetX).toBe(10);
    expect(bidiEdge.labelOffsetY).toBe(-5);
  });

  it('restores edge labels and technology', () => {
    const project = buildFullEdgeProject();
    const hash = serializeStateToHash({ project, activeDiagramId: project.rootDiagramId });
    const restored = deserializeStateFromHash(hash)!;

    const edges = restored.project.diagrams[project.rootDiagramId].edges;
    const fwdEdge = edges.find((e) => e.direction === 'forward')!;
    expect(fwdEdge.label).toBe('Forward');
    expect(fwdEdge.technology).toBe('HTTPS');
  });
});

// ---------------------------------------------------------------------------
// URL round-trip — subdiagram hierarchy
// ---------------------------------------------------------------------------

describe('URL sharing — subdiagram hierarchy round-trip', () => {
  it('preserves all diagrams in a multi-level project', () => {
    const project = buildSubdiagramProject();
    const hash = serializeStateToHash({ project, activeDiagramId: project.rootDiagramId });
    const restored = deserializeStateFromHash(hash)!;

    // The original project has root + container + component diagrams = 3 total
    const diagramCount = Object.keys(restored.project.diagrams).length;
    expect(diagramCount).toBe(Object.keys(project.diagrams).length);
  });

  it('preserves childDiagramId links across URL round-trip', () => {
    const project = buildSubdiagramProject();
    const hash = serializeStateToHash({ project, activeDiagramId: project.rootDiagramId });
    const restored = deserializeStateFromHash(hash)!;

    const rootDiag = restored.project.diagrams[project.rootDiagramId];
    const sysNode = rootDiag.nodes.find((n) => n.type === 'System')!;
    expect(sysNode.childDiagramId).toBeTruthy();

    const containerDiag = restored.project.diagrams[sysNode.childDiagramId!];
    expect(containerDiag).toBeDefined();
    expect(containerDiag.title).toBe('Container Level');
  });

  it('preserves the active diagram id (pointing to a sub-diagram)', () => {
    const project = buildSubdiagramProject();
    const rootDiag = project.diagrams[project.rootDiagramId];
    const sysNode = rootDiag.nodes.find((n) => n.type === 'System')!;
    const subDiagId = sysNode.childDiagramId!;

    const hash = serializeStateToHash({ project, activeDiagramId: subDiagId });
    const restored = deserializeStateFromHash(hash)!;

    expect(restored.activeDiagramId).toBe(subDiagId);
  });
});

// ---------------------------------------------------------------------------
// Node visual properties round-trip
// ---------------------------------------------------------------------------

describe('URL sharing — node visual properties round-trip', () => {
  it('preserves custom color, textColor, hideIcon, hideTypeLabel', () => {
    let project = createProject('Visual Props');
    const node = createNode({ type: 'System', label: 'Styled' });
    // Manually add visual properties that createNode does not accept yet
    const styledNode = { ...node, color: '#ff0000', textColor: '#ffffff', hideIcon: true, hideTypeLabel: true };
    project = addNodeToProject(project, project.rootDiagramId, styledNode);

    const hash = serializeStateToHash({ project, activeDiagramId: project.rootDiagramId });
    const restored = deserializeStateFromHash(hash)!;

    const restoredNode = restored.project.diagrams[project.rootDiagramId].nodes[0];
    expect(restoredNode.color).toBe('#ff0000');
    expect(restoredNode.textColor).toBe('#ffffff');
    expect(restoredNode.hideIcon).toBe(true);
    expect(restoredNode.hideTypeLabel).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildShareUrl
// ---------------------------------------------------------------------------

describe('buildShareUrl', () => {
  it('produces a full URL containing the hash', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'https://example.com',
        pathname: '/',
        hash: '',
      },
    });

    const project = createProject('Share URL Test');
    const url = buildShareUrl({ project, activeDiagramId: project.rootDiagramId });

    expect(url).toMatch(/^https:\/\/example\.com\/#share=/);
  });

  it('returns empty string when window is not defined', () => {
    // Default Node environment has no window
    vi.stubGlobal('window', undefined);
    const project = createProject();
    const url = buildShareUrl({ project });
    expect(url).toBe('');
  });

  it('produces a URL that can be round-tripped back to the snapshot', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'https://app.example.com',
        pathname: '/c4',
        hash: '',
      },
    });

    const project = createProject('Full Round Trip URL');
    const url = buildShareUrl({ project, activeDiagramId: project.rootDiagramId });

    // Extract the hash portion (everything from # onwards)
    const hashPart = url.substring(url.indexOf('#'));
    const restored = deserializeStateFromHash(hashPart);

    expect(restored).not.toBeNull();
    expect(restored!.project.name).toBe('Full Round Trip URL');
    expect(restored!.activeDiagramId).toBe(project.rootDiagramId);
  });
});

// ---------------------------------------------------------------------------
// Error / edge cases
// ---------------------------------------------------------------------------

describe('URL sharing — error and edge cases', () => {
  it('handles a snapshot without activeDiagramId', () => {
    const project = createProject('No Active');
    const hash = serializeStateToHash({ project });
    const restored = deserializeStateFromHash(hash);

    expect(restored).not.toBeNull();
    expect(restored!.activeDiagramId).toBeUndefined();
  });

  it('returns null for an empty hash', () => {
    expect(deserializeStateFromHash('')).toBeNull();
    expect(deserializeStateFromHash('#')).toBeNull();
  });

  it('returns null for a hash with unknown prefix', () => {
    expect(deserializeStateFromHash('#unknown=abc')).toBeNull();
  });

  it('produces different hashes for two different projects', () => {
    const p1 = createProject('Project A');
    const p2 = createProject('Project B');
    const hash1 = serializeStateToHash({ project: p1 });
    const hash2 = serializeStateToHash({ project: p2 });
    expect(hash1).not.toBe(hash2);
  });

  it('produces the same hash for two serializations of an identical snapshot', () => {
    const p = createProject('Deterministic');
    // Create a snapshot with a stable activeDiagramId (same rootDiagramId both times)
    const snapshot: UrlStateSnapshot = { project: p, activeDiagramId: p.rootDiagramId };
    const hash1 = serializeStateToHash(snapshot);
    const hash2 = serializeStateToHash(snapshot);
    // LZ-String + JSON.stringify of the same object should produce identical output
    expect(hash1).toBe(hash2);
  });

  it('correctly restores the project version field', () => {
    const project = createProject('Version Test');
    const hash = serializeStateToHash({ project });
    const restored = deserializeStateFromHash(hash)!;
    expect(restored.project.version).toBe('1');
  });
});
