'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  reconnectEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type Node,
  type Edge,
  type OnConnect,
  type OnReconnect,
  type OnNodesChange,
  type OnEdgesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  $project,
  $activeDiagramId,
  getActiveDiagram,
  loadProject,
  jumpToDiagram,
  updateNodePosition,
  updateNodeSize,
  addEdge as storeAddEdge,
  updateEdge as storeUpdateEdge,
  removeMultiple,
  pasteItems,
  persistCurrentState,
} from '../../stores/diagramStore';
import { $selectedNodeId, $selectedEdgeId, selectNode, selectEdge, clearSelection } from '../../stores/selectionStore';
import { $darkMode } from '../../stores/uiStore';
import type { C4Node as C4NodeData, C4Edge as C4EdgeData } from '../../lib/c4/types';
import { getStateFromUrl, clearStateFromUrl } from '../../lib/urlState';
import { saveToLocalStorage, loadFromLocalStorage } from '../../lib/localState';
import C4FlowNode from './C4FlowNode';
import { TextLabelNode, GroupBoxNode } from './AnnotationNode';
import CustomEdge from './CustomEdge';

// ---------------------------------------------------------------------------
// Module-level clipboard for copy/cut/paste operations
// ---------------------------------------------------------------------------
let clipboardData: { nodes: C4NodeData[]; edges: C4EdgeData[] } | null = null;
let pasteCount = 0;

// ---------------------------------------------------------------------------
// Custom node / edge types — defined outside component to avoid ReactFlow remounting
// ---------------------------------------------------------------------------
const nodeTypes = { c4node: C4FlowNode, textlabel: TextLabelNode, groupbox: GroupBoxNode };
const edgeTypes = { custom: CustomEdge };

// ---------------------------------------------------------------------------
// Node type colour map
// ---------------------------------------------------------------------------
const NODE_COLORS: Record<string, string> = {
  Person: '#1d4ed8',
  System: '#0f766e',
  SystemExt: '#64748b',
  Boundary: '#78350f',
  Container: '#065f46',
  ContainerDb: '#4c1d95',
  Component: '#1e3a5f',
  TextLabel: '#e2e8f0',
  GroupBox: '#6366f1',
};

/** Default text color for Boundary (near-transparent fill) — falls back to theme. */
const BOUNDARY_TEXT_COLOR_DARK = '#ffffff';
const BOUNDARY_TEXT_COLOR_LIGHT = '#1e293b';


// ---------------------------------------------------------------------------
// WCAG contrast helpers
// ---------------------------------------------------------------------------

/** Compute relative luminance of a 6-digit hex color per WCAG 2.1. */
function hexLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const linearize = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * Return '#ffffff' or '#0f172a' — whichever achieves higher WCAG contrast
 * against the given background hex color.
 */
function getContrastTextColor(bgHex: string): string {
  try {
    const lum = hexLuminance(bgHex);
    const contrastOnWhite = 1.05 / (lum + 0.05);
    const contrastOnDark = (lum + 0.05) / 0.058; // 0.058 = luminance(#0f172a) + 0.05
    return contrastOnWhite >= contrastOnDark ? '#ffffff' : '#0f172a';
  } catch {
    return '#ffffff';
  }
}

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

function toFlowNode(n: C4NodeData, selectedId: string | null, darkMode: boolean): Node {
  const color = n.color ?? NODE_COLORS[n.type] ?? '#374151';

  // Default text color for nodes that use textColor (all except TextLabel).
  // Boundary has a near-transparent fill so its text must contrast with the canvas;
  // all other nodes have a solid fill, so we pick white/dark based on luminance.
  const defaultTextColor =
    n.type === 'Boundary'
      ? (darkMode ? BOUNDARY_TEXT_COLOR_DARK : BOUNDARY_TEXT_COLOR_LIGHT)
      : getContrastTextColor(color);
  const textColor = n.type === 'TextLabel' ? undefined : (n.textColor ?? defaultTextColor);


  const isSelected = selectedId === n.id;
  const isAnnotation = n.type === 'TextLabel' || n.type === 'GroupBox';

  return {
    id: n.id,
    position: n.position,
    width: n.size.width,
    height: n.size.height,
    // Setting measured prevents ReactFlow from resetting handleBounds to undefined
    // on every setNodes call, which would cause edges to disappear until the
    // ResizeObserver fires again.
    measured: { width: n.size.width, height: n.size.height },
    zIndex: n.type === 'GroupBox' ? -1 : 0,
    data: {
      nodeType: n.type,
      label: n.label,
      description: n.description,
      technology: n.technology,
      childDiagramId: n.childDiagramId,
      color,
      textColor,
      isSelected,
      hideIcon: n.hideIcon,
      hideTypeLabel: n.hideTypeLabel,
    },
    style: {
      background: 'transparent',
      color: '#fff',
      border: 'none',
      borderRadius: 0,
      cursor: 'pointer',
      padding: 0,
      overflow: 'visible',
    },
    type: isAnnotation ? n.type.toLowerCase() : 'c4node',
    connectable: true,
  };
}

function toFlowEdge(
  e: C4EdgeData,
  selectedId: string | null,
  defaultEdgeColor: string,
  callbacks: {
    onBendPointsChange: (edgeId: string, bendPoints: Array<{ x: number; y: number }>) => void;
    onLabelOffsetChange: (edgeId: string, offsetX: number, offsetY: number) => void;
    onAddBendPoint: (edgeId: string, index: number, point: { x: number; y: number }) => void;
  },
): Edge {
  const isSelected = selectedId === e.id;
  const strokeColor = isSelected ? '#facc15' : defaultEdgeColor;
  const direction = e.direction ?? 'forward';
  const marker = { type: 'arrowclosed' as const, color: strokeColor };

  let markerStart: Edge['markerStart'];
  let markerEnd: Edge['markerEnd'];
  if (direction === 'reverse') {
    markerStart = marker;
  } else if (direction === 'bidirectional') {
    markerStart = marker;
    markerEnd = marker;
  } else if (direction === 'none') {
    markerStart = undefined;
    markerEnd = undefined;
  } else {
    markerEnd = marker;
  }

  return {
    id: e.id,
    type: 'custom',
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    label: e.label ?? undefined,
    style: {
      stroke: strokeColor,
      strokeWidth: 1.5,
    },
    labelStyle: { color: strokeColor, fontSize: 11 },
    labelBgStyle: { fill: 'var(--c4-edge-label-bg)' },
    markerStart,
    markerEnd,
    reconnectable: isSelected,
    data: {
      pathMode: e.pathMode ?? 'bezier',
      bendPoints: e.bendPoints ?? [],
      labelOffsetX: e.labelOffsetX ?? 0,
      labelOffsetY: e.labelOffsetY ?? 0,
      isSelected,
      onBendPointsChange: callbacks.onBendPointsChange,
      onLabelOffsetChange: callbacks.onLabelOffsetChange,
      onAddBendPoint: callbacks.onAddBendPoint,
    },
  };
}

// ---------------------------------------------------------------------------
// Inner component: re-fits the view whenever the active diagram changes
// ---------------------------------------------------------------------------

function FitViewOnDiagramChange({ activeDiagramId }: { activeDiagramId: string | null }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (!activeDiagramId) return;
    const timer = setTimeout(() => {
      fitView({ padding: 0.1 });
    }, 50);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDiagramId]);
  return null;
}

// ---------------------------------------------------------------------------
// Canvas component
// ---------------------------------------------------------------------------

export default function DiagramCanvas() {
  const project = useStore($project);
  const activeDiagramId = useStore($activeDiagramId);
  const selectedNodeId = useStore($selectedNodeId);
  const selectedEdgeId = useStore($selectedEdgeId);
  const darkMode = useStore($darkMode);

  const diagram = getActiveDiagram();

  // Edge color depends on theme
  const edgeColor = darkMode ? '#94a3b8' : '#475569';

  const reconnectingRef = useRef(false);
  const restoringFromUrlRef = useRef(false);
  const [reconnectingEdgeId, setReconnectingEdgeId] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Edge data callbacks (bend points, label offset)
  // -------------------------------------------------------------------------

  const handleBendPointsChange = useCallback(
    (edgeId: string, bendPoints: Array<{ x: number; y: number }>) => {
      storeUpdateEdge(edgeId, { bendPoints });
    },
    [],
  );

  const handleLabelOffsetChange = useCallback(
    (edgeId: string, offsetX: number, offsetY: number) => {
      storeUpdateEdge(edgeId, { labelOffsetX: offsetX, labelOffsetY: offsetY });
    },
    [],
  );

  const handleAddBendPoint = useCallback(
    (edgeId: string, segmentIndex: number, point: { x: number; y: number }) => {
      const proj = $project.get();
      const diagId = $activeDiagramId.get();
      if (!proj || !diagId) return;
      const diag = proj.diagrams[diagId];
      const edge = diag?.edges.find((e) => e.id === edgeId);
      if (!edge) return;
      const bps = [...(edge.bendPoints ?? [])];
      bps.splice(segmentIndex, 0, point);
      storeUpdateEdge(edgeId, { bendPoints: bps });
    },
    [],
  );

  const edgeCallbacks = useMemo(
    () => ({
      onBendPointsChange: handleBendPointsChange,
      onLabelOffsetChange: handleLabelOffsetChange,
      onAddBendPoint: handleAddBendPoint,
    }),
    [handleBendPointsChange, handleLabelOffsetChange, handleAddBendPoint],
  );

  useEffect(() => {
    const snapshot = getStateFromUrl();
    if (snapshot) {
      restoringFromUrlRef.current = true;
      loadProject(snapshot.project);
      if (snapshot.activeDiagramId && snapshot.activeDiagramId !== snapshot.project.rootDiagramId) {
        jumpToDiagram(snapshot.activeDiagramId);
      }
      restoringFromUrlRef.current = false;
      // Persist the URL-loaded state to localStorage so it survives after the
      // hash is removed from the URL (and on subsequent page loads / refreshes).
      persistCurrentState();
      clearStateFromUrl();
      return;
    }
    // Fallback: restore from localStorage if no URL state
    const local = loadFromLocalStorage();
    if (local) {
      restoringFromUrlRef.current = true;
      loadProject(local.project);
      if (local.activeDiagramId && local.activeDiagramId !== local.project.rootDiagramId) {
        jumpToDiagram(local.activeDiagramId);
      }
      restoringFromUrlRef.current = false;
    }
  }, []);

  // Ctrl+S / Cmd+S — explicit save to localStorage
  useEffect(() => {
    function handleSave(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        persistCurrentState();
      }
    }
    window.addEventListener('keydown', handleSave);
    return () => window.removeEventListener('keydown', handleSave);
  }, []);

  const initialNodes = useMemo(
    () => (diagram?.nodes ?? []).map((n) => toFlowNode(n, selectedNodeId, darkMode)),
    // Intentionally limited to diagram identity changes only; selection highlight
    // updates are handled separately via a dedicated useEffect to avoid full remounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeDiagramId, diagram?.id],
  );

  const initialEdges = useMemo(
    () => (diagram?.edges ?? []).map((e) => toFlowEdge(e, selectedEdgeId, edgeColor, edgeCallbacks)),
    // Same reasoning as initialNodes above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeDiagramId, diagram?.id],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when active diagram changes
  useEffect(() => {
    const d = getActiveDiagram();
    setNodes((d?.nodes ?? []).map((n) => toFlowNode(n, selectedNodeId, darkMode)));
    setEdges((d?.edges ?? []).map((e) => {
      const flowEdge = toFlowEdge(e, selectedEdgeId, edgeColor, edgeCallbacks);
      flowEdge.reconnectable = selectedEdgeId === e.id || reconnectingEdgeId === e.id;
      return flowEdge;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDiagramId]);

  // Sync when project data changes (e.g. after node/edge additions from toolbar)
  useEffect(() => {
    if (!project) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const d = getActiveDiagram();
    setNodes((d?.nodes ?? []).map((n) => toFlowNode(n, selectedNodeId, darkMode)));
    setEdges((d?.edges ?? []).map((e) => {
      const flowEdge = toFlowEdge(e, selectedEdgeId, edgeColor, edgeCallbacks);
      flowEdge.reconnectable = selectedEdgeId === e.id || reconnectingEdgeId === e.id;
      return flowEdge;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  // Re-apply edge colors when theme changes
  useEffect(() => {
    setEdges((eds) =>
      eds.map((e) => {
        const isSelected = selectedEdgeId === e.id;
        const strokeColor = isSelected ? '#facc15' : edgeColor;
        const marker = { type: 'arrowclosed' as const, color: strokeColor };
        const c4Edge = diagram?.edges.find((edge) => edge.id === e.id);
        const direction = c4Edge?.direction ?? 'forward';

        let markerStart: Edge['markerStart'];
        let markerEnd: Edge['markerEnd'];
        if (direction === 'reverse') {
          markerStart = marker;
        } else if (direction === 'bidirectional') {
          markerStart = marker;
          markerEnd = marker;
        } else if (direction === 'none') {
          markerStart = undefined;
          markerEnd = undefined;
        } else {
          markerEnd = marker;
        }

        return {
          ...e,
          style: { ...e.style, stroke: strokeColor },
          labelStyle: { color: strokeColor, fontSize: 11 },
          markerStart,
          markerEnd,
        };
      }),
    );
    const d = getActiveDiagram();
    setNodes((d?.nodes ?? []).map((n) => toFlowNode(n, selectedNodeId, darkMode)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [darkMode]);

  // Update selection highlights
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isSelected: selectedNodeId === n.id,
        },
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId]);

  useEffect(() => {
    setEdges((eds) =>
      eds.map((e) => {
        const strokeColor = selectedEdgeId === e.id ? '#facc15' : edgeColor;
        const marker = { type: 'arrowclosed' as const, color: strokeColor };
        const direction = (diagram?.edges.find((edge) => edge.id === e.id)?.direction) ?? 'forward';

        let markerStart: Edge['markerStart'];
        let markerEnd: Edge['markerEnd'];
        if (direction === 'reverse') {
          markerStart = marker;
        } else if (direction === 'bidirectional') {
          markerStart = marker;
          markerEnd = marker;
        } else if (direction === 'none') {
          markerStart = undefined;
          markerEnd = undefined;
        } else {
          markerEnd = marker;
        }

        const c4Edge = diagram?.edges.find((edge) => edge.id === e.id);

        return {
          ...e,
          style: {
            ...e.style,
            stroke: strokeColor,
          },
          labelStyle: { color: strokeColor, fontSize: 11 },
          markerStart,
          markerEnd,
          reconnectable: selectedEdgeId === e.id || reconnectingEdgeId === e.id,
          data: {
            ...(e.data ?? {}),
            pathMode: c4Edge?.pathMode ?? 'bezier',
            bendPoints: c4Edge?.bendPoints ?? [],
            labelOffsetX: c4Edge?.labelOffsetX ?? 0,
            labelOffsetY: c4Edge?.labelOffsetY ?? 0,
            isSelected: selectedEdgeId === e.id,
            onBendPointsChange: edgeCallbacks.onBendPointsChange,
            onLabelOffsetChange: edgeCallbacks.onLabelOffsetChange,
            onAddBendPoint: edgeCallbacks.onAddBendPoint,
          },
        };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagram, reconnectingEdgeId, selectedEdgeId, edgeColor]);

  // Drag — update position in store (no snapshot to avoid cluttering history)
  const handleNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);

      // Batch all node removals into a single history snapshot
      const removedNodeIds = changes.filter((c) => c.type === 'remove').map((c) => c.id);
      if (removedNodeIds.length > 0) {
        removeMultiple(removedNodeIds, []);
      }

      for (const change of changes) {
        if (change.type === 'position' && !change.dragging && change.position) {
          updateNodePosition(change.id, change.position.x, change.position.y);
        }
        if (change.type === 'dimensions' && change.dimensions && !change.resizing) {
          updateNodeSize(change.id, change.dimensions.width, change.dimensions.height);
        }
      }
    },
    [onNodesChange],
  );

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);

      if (reconnectingRef.current) {
        // React Flow can emit transient edge remove changes while an endpoint
        // is being dragged; ignore them to avoid flicker/disappearing edges.
        return;
      }

      // Batch all edge removals into a single history snapshot
      const removedEdgeIds = changes.filter((c) => c.type === 'remove').map((c) => c.id);
      if (removedEdgeIds.length > 0) {
        removeMultiple([], removedEdgeIds);
      }
    },
    [onEdgesChange],
  );

  // Connect nodes — create edge in store
  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (selectedEdgeId) return;

      setEdges((eds) => addEdge(connection, eds));
      if (connection.source && connection.target) {
        storeAddEdge(
          connection.source,
          connection.target,
          connection.sourceHandle ?? undefined,
          connection.targetHandle ?? undefined,
        );
      }
    },
    [selectedEdgeId, setEdges],
  );

  const handleReconnect: OnReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (selectedEdgeId !== oldEdge.id) return;

      setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds));

      if (!newConnection.source || !newConnection.target) {
        return;
      }

      storeUpdateEdge(oldEdge.id, {
        source: newConnection.source,
        target: newConnection.target,
        sourceHandle: newConnection.sourceHandle ?? undefined,
        targetHandle: newConnection.targetHandle ?? undefined,
      });
    },
    [selectedEdgeId, setEdges],
  );

  const handleReconnectStart = useCallback(() => {
    reconnectingRef.current = true;
  }, []);

  const handleReconnectEnd = useCallback(() => {
    reconnectingRef.current = false;
    setReconnectingEdgeId(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Multi-selection tracking (used by clipboard operations)
  // ---------------------------------------------------------------------------

  /** Ref that always holds the currently selected node/edge IDs (from ReactFlow). */
  const selectedItemsRef = useRef<{ nodeIds: string[]; edgeIds: string[] }>({
    nodeIds: [],
    edgeIds: [],
  });

  const handleSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
      const nodeIds = selNodes.map((n) => n.id);
      const edgeIds = selEdges.map((e) => e.id);
      selectedItemsRef.current = { nodeIds, edgeIds };

      // When multiple items are selected clear the single-item selection so the
      // Properties panel doesn't show stale data.
      if (nodeIds.length > 1 || edgeIds.length > 1 || (nodeIds.length > 0 && edgeIds.length > 0)) {
        clearSelection();
      } else if (nodeIds.length === 0 && edgeIds.length === 0) {
        clearSelection();
      }
      // Single-item selection is handled by handleNodeClick / handleEdgeClick.
    },
    [],
  );

  // Selection
  const handleNodeClick = useCallback((e: React.MouseEvent, node: Node) => {
    if (reconnectingRef.current) return;
    // When Ctrl/Meta/Shift is held ReactFlow is building a multi-selection;
    // let onSelectionChange handle it instead of overwriting with a single item.
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
    selectNode(node.id);
  }, []);

  const handleEdgeClick = useCallback((e: React.MouseEvent, edge: Edge) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
    selectEdge(edge.id);
  }, []);

  const handlePaneClick = useCallback(() => {
    if (reconnectingRef.current) return;
    clearSelection();
  }, []);

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts: Ctrl+C copy, Ctrl+X cut, Ctrl+V paste
  // ---------------------------------------------------------------------------

  useEffect(() => {
    function handleClipboardKeys(e: KeyboardEvent) {
      if (!activeDiagramId) return;
      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;

      if (e.key === 'c' || e.key === 'x') {
        const { nodeIds, edgeIds } = selectedItemsRef.current;
        const diag = getActiveDiagram();
        if (!diag) return;
        const nodes = diag.nodes.filter((n) => nodeIds.includes(n.id));
        const edges = diag.edges.filter((ed) => edgeIds.includes(ed.id));
        if (nodes.length === 0 && edges.length === 0) return;

        e.preventDefault();
        clipboardData = { nodes, edges };
        pasteCount = 0;

        if (e.key === 'x') {
          removeMultiple(nodeIds, edgeIds);
          clearSelection();
          selectedItemsRef.current = { nodeIds: [], edgeIds: [] };
        }
      }

      if (e.key === 'v') {
        if (!clipboardData || (clipboardData.nodes.length === 0 && clipboardData.edges.length === 0)) return;
        e.preventDefault();
        pasteCount += 1;
        const offset = pasteCount * 20;
        pasteItems(clipboardData.nodes, clipboardData.edges, offset, offset);
      }
    }

    window.addEventListener('keydown', handleClipboardKeys);
    return () => window.removeEventListener('keydown', handleClipboardKeys);
  }, [activeDiagramId]);

  // ---------------------------------------------------------------------------
  // Empty / no-project states
  // ---------------------------------------------------------------------------
  if (!project) {
    return (
      <div
        className="relative w-full h-full flex flex-col items-center justify-center select-none"
        style={{ backgroundColor: 'var(--c4-canvas-bg)' }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle, var(--c4-canvas-dots) 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative z-10 flex flex-col items-center gap-4 text-center p-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2"
            style={{ backgroundColor: 'var(--c4-secondary-bg)' }}
          >
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2h-2a2 2 0 01-2-2" />
            </svg>
          </div>
          <p className="font-medium" style={{ color: 'var(--c4-text-secondary)' }}>No project open</p>
          <p className="text-sm max-w-xs" style={{ color: 'var(--c4-text-muted)' }}>
            Use <strong className="text-blue-400">New Project</strong> in the toolbar to create a project.
          </p>
        </div>
      </div>
    );
  }

  const canvasDotColor = darkMode ? '#374151' : '#cbd5e1';

  return (
    <div
      id="diagram-canvas-container"
      style={{ width: '100%', height: '100%', backgroundColor: 'var(--c4-canvas-bg)' }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onReconnect={handleReconnect}
        onReconnectStart={(_, edge) => {
          handleReconnectStart();
          setReconnectingEdgeId(edge.id);
          selectEdge(edge.id);
        }}
        onReconnectEnd={handleReconnectEnd}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        onSelectionChange={handleSelectionChange}
        selectionKeyCode="Control"
        edgesReconnectable
        nodesConnectable={!selectedEdgeId}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'custom' }}
        fitView
        deleteKeyCode="Delete"
        colorMode={darkMode ? 'dark' : 'light'}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} color={canvasDotColor} />
        <Controls />
        <MiniMap nodeColor={(n) => {
          const d = n.data as { nodeType?: string; color?: string };
          if (d.color && (d.nodeType === 'TextLabel' || d.nodeType === 'GroupBox')) return d.color;
          return NODE_COLORS[d.nodeType ?? ''] ?? '#374151';
        }} />
        <FitViewOnDiagramChange activeDiagramId={activeDiagramId} />
      </ReactFlow>
    </div>
  );
}
