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

// ---------------------------------------------------------------------------
// Visual-only annotation (free text label)
// ---------------------------------------------------------------------------

export interface C4Annotation {
  id: string;
  text: string;
  position: C4Position;
  size: { width: number; height: number };
  /** Font size in px (default 13) */
  fontSize?: number;
  /** CSS colour string (default '#94a3b8') */
  color?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
}

// ---------------------------------------------------------------------------
// Visual-only group box (semi-transparent rectangle to group elements)
// ---------------------------------------------------------------------------

export type C4GroupBoxBorderStyle = 'solid' | 'dashed' | 'dotted';

export interface C4GroupBox {
  id: string;
  label?: string;
  position: C4Position;
  size: { width: number; height: number };
  /** Border colour (default '#6366f1') */
  borderColor?: string;
  /** Fill colour including opacity, e.g. 'rgba(99,102,241,0.08)' */
  fillColor?: string;
  borderStyle?: C4GroupBoxBorderStyle;
  /** Label font size in px (default 12) */
  fontSize?: number;
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
  /** Visual-only free text annotations */
  annotations?: C4Annotation[];
  /** Visual-only grouping boxes */
  groupBoxes?: C4GroupBox[];
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
