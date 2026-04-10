import type {
  C4Diagram,
  C4Edge,
  C4Level,
  C4Node,
  C4NodeType,
  C4Project,
} from './types';

export const MAX_DEPTH = 10;
const DEFAULT_NODE_WIDTH = 160;
const DEFAULT_NODE_HEIGHT = 80;

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

export function generateId(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// Node helpers
// ---------------------------------------------------------------------------

export interface CreateNodeOptions {
  type?: C4NodeType;
  label?: string;
  description?: string;
  technology?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export function createNode(options: CreateNodeOptions = {}): C4Node {
  return {
    id: generateId('node'),
    type: options.type ?? 'System',
    label: options.label ?? 'New System',
    description: options.description,
    technology: options.technology,
    position: { x: options.x ?? 100, y: options.y ?? 100 },
    size: {
      width: options.width ?? DEFAULT_NODE_WIDTH,
      height: options.height ?? DEFAULT_NODE_HEIGHT,
    },
  };
}

// ---------------------------------------------------------------------------
// Edge helpers
// ---------------------------------------------------------------------------

export interface CreateEdgeOptions {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  direction?: C4Edge['direction'];
  label?: string;
  technology?: string;
}

export function createEdge(options: CreateEdgeOptions): C4Edge {
  return {
    id: generateId('edge'),
    source: options.source,
    target: options.target,
    sourceHandle: options.sourceHandle,
    targetHandle: options.targetHandle,
    direction: options.direction,
    label: options.label,
    technology: options.technology,
  };
}

// ---------------------------------------------------------------------------
// Diagram helpers
// ---------------------------------------------------------------------------

export interface CreateDiagramOptions {
  title?: string;
  level?: C4Level;
  depth?: number;
  parentNodeId?: string;
}

export function createDiagram(options: CreateDiagramOptions = {}): C4Diagram {
  const now = new Date().toISOString();
  return {
    id: generateId('diag'),
    level: options.level ?? 'context',
    depth: options.depth ?? 0,
    parentNodeId: options.parentNodeId,
    title: options.title ?? 'New Diagram',
    nodes: [],
    edges: [],
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Project helpers
// ---------------------------------------------------------------------------

export function createProject(name = 'New Project'): C4Project {
  const rootDiagram = createDiagram({ title: `${name} — Context`, level: 'context', depth: 0 });
  return {
    id: generateId('proj'),
    name,
    rootDiagramId: rootDiagram.id,
    diagrams: { [rootDiagram.id]: rootDiagram },
    version: '1',
  };
}

// ---------------------------------------------------------------------------
// Diagram mutation helpers (return new copies — immutable)
// ---------------------------------------------------------------------------

function touchDiagram(diagram: C4Diagram): C4Diagram {
  return { ...diagram, updatedAt: new Date().toISOString() };
}

export function addNodeToDiagram(diagram: C4Diagram, node: C4Node): C4Diagram {
  return touchDiagram({ ...diagram, nodes: [...diagram.nodes, node] });
}

export function removeNodeFromDiagram(diagram: C4Diagram, nodeId: string): C4Diagram {
  return touchDiagram({
    ...diagram,
    nodes: diagram.nodes.filter((n) => n.id !== nodeId),
    edges: diagram.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
  });
}

export function updateNodeInDiagram(
  diagram: C4Diagram,
  nodeId: string,
  patch: Partial<Omit<C4Node, 'id'>>,
): C4Diagram {
  return touchDiagram({
    ...diagram,
    nodes: diagram.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
  });
}

export function updateNodePosition(
  diagram: C4Diagram,
  nodeId: string,
  x: number,
  y: number,
): C4Diagram {
  return updateNodeInDiagram(diagram, nodeId, { position: { x, y } });
}

export function addEdgeToDiagram(diagram: C4Diagram, edge: C4Edge): C4Diagram {
  return touchDiagram({ ...diagram, edges: [...diagram.edges, edge] });
}

export function removeEdgeFromDiagram(diagram: C4Diagram, edgeId: string): C4Diagram {
  return touchDiagram({
    ...diagram,
    edges: diagram.edges.filter((e) => e.id !== edgeId),
  });
}

export function updateEdgeInDiagram(
  diagram: C4Diagram,
  edgeId: string,
  patch: Partial<Omit<C4Edge, 'id'>>,
): C4Diagram {
  return touchDiagram({
    ...diagram,
    edges: diagram.edges.map((e) => (e.id === edgeId ? { ...e, ...patch } : e)),
  });
}

// ---------------------------------------------------------------------------
// Sub-diagram helpers
// ---------------------------------------------------------------------------

/**
 * Creates a child diagram for the given node and wires up `childDiagramId`.
 * Returns the updated project (immutable).
 * Throws if the parent diagram would exceed MAX_DEPTH.
 */
export function createSubdiagram(
  project: C4Project,
  parentDiagramId: string,
  nodeId: string,
  options: CreateDiagramOptions = {},
): C4Project {
  const parentDiagram = project.diagrams[parentDiagramId];
  if (!parentDiagram) {
    throw new Error(`Parent diagram "${parentDiagramId}" not found`);
  }

  const newDepth = parentDiagram.depth + 1;
  if (newDepth > MAX_DEPTH) {
    throw new Error(
      `Cannot create sub-diagram: maximum nesting depth (${MAX_DEPTH}) exceeded`,
    );
  }

  const node = parentDiagram.nodes.find((n) => n.id === nodeId);
  if (!node) {
    throw new Error(`Node "${nodeId}" not found in diagram "${parentDiagramId}"`);
  }

  const childDiagram = createDiagram({
    ...options,
    depth: newDepth,
    parentNodeId: nodeId,
    level: options.level ?? nextLevel(parentDiagram.level),
  });

  const updatedParentDiagram = updateNodeInDiagram(parentDiagram, nodeId, {
    childDiagramId: childDiagram.id,
  });

  return {
    ...project,
    diagrams: {
      ...project.diagrams,
      [parentDiagramId]: updatedParentDiagram,
      [childDiagram.id]: childDiagram,
    },
  };
}

function nextLevel(level: C4Level): C4Level {
  const order: C4Level[] = ['context', 'container', 'component', 'code'];
  const idx = order.indexOf(level);
  // If already at 'code' or unrecognised, stay at 'component' (lowest non-leaf level)
  return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : 'component';
}

// ---------------------------------------------------------------------------
// Project-level mutation helpers
// ---------------------------------------------------------------------------

export function updateDiagramInProject(
  project: C4Project,
  diagramId: string,
  diagram: C4Diagram,
): C4Project {
  return {
    ...project,
    diagrams: { ...project.diagrams, [diagramId]: diagram },
  };
}

export function addNodeToProject(
  project: C4Project,
  diagramId: string,
  node: C4Node,
): C4Project {
  const diagram = project.diagrams[diagramId];
  if (!diagram) return project;
  return updateDiagramInProject(project, diagramId, addNodeToDiagram(diagram, node));
}

export function removeNodeFromProject(
  project: C4Project,
  diagramId: string,
  nodeId: string,
): C4Project {
  const diagram = project.diagrams[diagramId];
  if (!diagram) return project;
  return updateDiagramInProject(
    project,
    diagramId,
    removeNodeFromDiagram(diagram, nodeId),
  );
}

export function updateNodeInProject(
  project: C4Project,
  diagramId: string,
  nodeId: string,
  patch: Partial<Omit<C4Node, 'id'>>,
): C4Project {
  const diagram = project.diagrams[diagramId];
  if (!diagram) return project;
  return updateDiagramInProject(
    project,
    diagramId,
    updateNodeInDiagram(diagram, nodeId, patch),
  );
}

export function addEdgeToProject(
  project: C4Project,
  diagramId: string,
  edge: C4Edge,
): C4Project {
  const diagram = project.diagrams[diagramId];
  if (!diagram) return project;
  return updateDiagramInProject(project, diagramId, addEdgeToDiagram(diagram, edge));
}

export function removeEdgeFromProject(
  project: C4Project,
  diagramId: string,
  edgeId: string,
): C4Project {
  const diagram = project.diagrams[diagramId];
  if (!diagram) return project;
  return updateDiagramInProject(
    project,
    diagramId,
    removeEdgeFromDiagram(diagram, edgeId),
  );
}

export function updateEdgeInProject(
  project: C4Project,
  diagramId: string,
  edgeId: string,
  patch: Partial<Omit<C4Edge, 'id'>>,
): C4Project {
  const diagram = project.diagrams[diagramId];
  if (!diagram) return project;
  return updateDiagramInProject(
    project,
    diagramId,
    updateEdgeInDiagram(diagram, edgeId, patch),
  );
}
