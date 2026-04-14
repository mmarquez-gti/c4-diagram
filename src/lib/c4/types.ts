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
  | 'Component'
  /** Free-floating text annotation — no connection handles */
  | 'TextLabel'
  /** Visual grouping box placed behind other nodes */
  | 'GroupBox';

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
  /** Custom accent color (hex). Used by TextLabel and GroupBox; optional for other types. */
  color?: string;
  /** Custom text color (hex) for the node labels. Overrides the default white text. */
  textColor?: string;
  /** Hide the per-type SVG icon inside the node shape (non-annotation nodes only). */
  hideIcon?: boolean;
  /** Hide the small uppercase type-name label (e.g. "BOUNDARY") inside the node shape. */
  hideTypeLabel?: boolean;
}

export type C4EdgeDirection = 'forward' | 'reverse' | 'bidirectional' | 'none';

/**
 * Edge path rendering mode:
 * - 'bezier'     — smooth Bezier curve (default, like draw.io curved)
 * - 'straight'   — direct straight line
 * - 'orthogonal' — axis-aligned right-angle segments
 */
export type C4EdgePathMode = 'bezier' | 'straight' | 'orthogonal';

/** A 2D point used as a bend/waypoint along an edge path. */
export interface C4BendPoint {
  x: number;
  y: number;
}

export interface C4Edge {
  id: string;
  source: string; // C4Node.id
  target: string; // C4Node.id
  sourceHandle?: string;
  targetHandle?: string;
  direction?: C4EdgeDirection;
  label?: string;
  technology?: string;
  /** How the edge path is rendered (default: 'bezier'). */
  pathMode?: C4EdgePathMode;
  /** Intermediate bend/waypoints — the edge path passes through these in order. */
  bendPoints?: C4BendPoint[];
  /**
   * Horizontal offset (in px) of the label from its default midpoint position.
   * Positive values push the label rightward.
   */
  labelOffsetX?: number;
  /**
   * Vertical offset (in px) of the label from its default midpoint position.
   * Positive values push the label downward.
   */
  labelOffsetY?: number;
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
