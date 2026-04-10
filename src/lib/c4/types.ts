// C4 standard levels
export type C4Level = 'context' | 'container' | 'component' | 'code';

// C4 node types as defined in the C4 model spec
export type C4NodeType =
  | 'Person'
  | 'System'
  | 'SystemExt'
  | 'Boundary'
  | 'Container'
  | 'ContainerDb'
  | 'Component';

export interface C4Position {
  x: number;
  y: number;
}

export interface C4Node {
  id: string;
  type: C4NodeType;
  label: string;
  description?: string;
  technology?: string;
  position: C4Position;
  size: { width: number; height: number };
  /** Reference to a nested sub-diagram (drill-down), max depth 10 */
  childDiagramId?: string;
}

export interface C4Edge {
  id: string;
  source: string; // C4Node.id
  target: string; // C4Node.id
  label?: string;
  technology?: string;
}

export interface C4Diagram {
  id: string;
  level: C4Level;
  /** 0 = root diagram, max allowed is 10 */
  depth: number;
  /** ID of the parent node that contains this diagram (undefined for root) */
  parentNodeId?: string;
  title: string;
  nodes: C4Node[];
  edges: C4Edge[];
  /** Cached Mermaid serialisation — regenerated on save */
  mermaidCache?: string;
  createdAt: string;
  updatedAt: string;
}

/** The full project — a tree of diagrams stored flat by id */
export interface C4Project {
  id: string;
  name: string;
  rootDiagramId: string;
  diagrams: Record<string, C4Diagram>;
  /** Schema version for future migrations */
  version: string;
}
