import type {
  C4Annotation,
  C4Diagram,
  C4Edge,
  C4GroupBox,
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
  pathMode?: C4Edge['pathMode'];
  bendPoints?: C4Edge['bendPoints'];
  labelOffsetX?: number;
  labelOffsetY?: number;
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
    pathMode: options.pathMode,
    bendPoints: options.bendPoints,
    labelOffsetX: options.labelOffsetX,
    labelOffsetY: options.labelOffsetY,
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

// ---------------------------------------------------------------------------
// Annotation helpers
// ---------------------------------------------------------------------------

export interface CreateAnnotationOptions {
  text?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fontSize?: number;
  color?: string;
  fontWeight?: C4Annotation['fontWeight'];
  fontStyle?: C4Annotation['fontStyle'];
}

export function createAnnotation(options: CreateAnnotationOptions = {}): C4Annotation {
  return {
    id: generateId('ann'),
    text: options.text ?? 'Text',
    position: { x: options.x ?? 100, y: options.y ?? 100 },
    size: { width: options.width ?? 160, height: options.height ?? 50 },
    fontSize: options.fontSize,
    color: options.color,
    fontWeight: options.fontWeight,
    fontStyle: options.fontStyle,
  };
}

export function addAnnotationToDiagram(diagram: C4Diagram, annotation: C4Annotation): C4Diagram {
  return touchDiagram({ ...diagram, annotations: [...(diagram.annotations ?? []), annotation] });
}

export function removeAnnotationFromDiagram(diagram: C4Diagram, annotationId: string): C4Diagram {
  return touchDiagram({
    ...diagram,
    annotations: (diagram.annotations ?? []).filter((a) => a.id !== annotationId),
  });
}

export function updateAnnotationInDiagram(
  diagram: C4Diagram,
  annotationId: string,
  patch: Partial<Omit<C4Annotation, 'id'>>,
): C4Diagram {
  return touchDiagram({
    ...diagram,
    annotations: (diagram.annotations ?? []).map((a) =>
      a.id === annotationId ? { ...a, ...patch } : a,
    ),
  });
}

export function addAnnotationToProject(
  project: C4Project,
  diagramId: string,
  annotation: C4Annotation,
): C4Project {
  const diagram = project.diagrams[diagramId];
  if (!diagram) return project;
  return updateDiagramInProject(project, diagramId, addAnnotationToDiagram(diagram, annotation));
}

export function removeAnnotationFromProject(
  project: C4Project,
  diagramId: string,
  annotationId: string,
): C4Project {
  const diagram = project.diagrams[diagramId];
  if (!diagram) return project;
  return updateDiagramInProject(project, diagramId, removeAnnotationFromDiagram(diagram, annotationId));
}

export function updateAnnotationInProject(
  project: C4Project,
  diagramId: string,
  annotationId: string,
  patch: Partial<Omit<C4Annotation, 'id'>>,
): C4Project {
  const diagram = project.diagrams[diagramId];
  if (!diagram) return project;
  return updateDiagramInProject(
    project,
    diagramId,
    updateAnnotationInDiagram(diagram, annotationId, patch),
  );
}

// ---------------------------------------------------------------------------
// GroupBox helpers
// ---------------------------------------------------------------------------

export interface CreateGroupBoxOptions {
  label?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  borderColor?: string;
  fillColor?: string;
  borderStyle?: C4GroupBox['borderStyle'];
  fontSize?: number;
}

export function createGroupBox(options: CreateGroupBoxOptions = {}): C4GroupBox {
  return {
    id: generateId('grp'),
    label: options.label,
    position: { x: options.x ?? 80, y: options.y ?? 80 },
    size: { width: options.width ?? 300, height: options.height ?? 200 },
    borderColor: options.borderColor,
    fillColor: options.fillColor,
    borderStyle: options.borderStyle,
    fontSize: options.fontSize,
  };
}

export function addGroupBoxToDiagram(diagram: C4Diagram, groupBox: C4GroupBox): C4Diagram {
  return touchDiagram({ ...diagram, groupBoxes: [...(diagram.groupBoxes ?? []), groupBox] });
}

export function removeGroupBoxFromDiagram(diagram: C4Diagram, groupBoxId: string): C4Diagram {
  return touchDiagram({
    ...diagram,
    groupBoxes: (diagram.groupBoxes ?? []).filter((g) => g.id !== groupBoxId),
  });
}

export function updateGroupBoxInDiagram(
  diagram: C4Diagram,
  groupBoxId: string,
  patch: Partial<Omit<C4GroupBox, 'id'>>,
): C4Diagram {
  return touchDiagram({
    ...diagram,
    groupBoxes: (diagram.groupBoxes ?? []).map((g) =>
      g.id === groupBoxId ? { ...g, ...patch } : g,
    ),
  });
}

export function addGroupBoxToProject(
  project: C4Project,
  diagramId: string,
  groupBox: C4GroupBox,
): C4Project {
  const diagram = project.diagrams[diagramId];
  if (!diagram) return project;
  return updateDiagramInProject(project, diagramId, addGroupBoxToDiagram(diagram, groupBox));
}

export function removeGroupBoxFromProject(
  project: C4Project,
  diagramId: string,
  groupBoxId: string,
): C4Project {
  const diagram = project.diagrams[diagramId];
  if (!diagram) return project;
  return updateDiagramInProject(project, diagramId, removeGroupBoxFromDiagram(diagram, groupBoxId));
}

export function updateGroupBoxInProject(
  project: C4Project,
  diagramId: string,
  groupBoxId: string,
  patch: Partial<Omit<C4GroupBox, 'id'>>,
): C4Project {
  const diagram = project.diagrams[diagramId];
  if (!diagram) return project;
  return updateDiagramInProject(
    project,
    diagramId,
    updateGroupBoxInDiagram(diagram, groupBoxId, patch),
  );
}
