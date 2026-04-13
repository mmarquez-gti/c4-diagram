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
  removeNode,
  removeEdge,
  persistCurrentState,
  updateAnnotationPosition,
  updateAnnotationSize,
  removeAnnotation,
  updateGroupBoxPosition,
  updateGroupBoxSize,
  removeGroupBox,
} from '../../stores/diagramStore';
import { $selectedNodeId, $selectedEdgeId, selectNode, selectEdge, clearSelection } from '../../stores/selectionStore';
import type { C4Node as C4NodeData, C4Edge as C4EdgeData, C4Annotation, C4GroupBox } from '../../lib/c4/types';
import { getStateFromUrl, replaceStateInUrl } from '../../lib/urlState';
import { saveToLocalStorage, loadFromLocalStorage } from '../../lib/localState';
import C4FlowNode from './C4FlowNode';
import CustomEdge from './CustomEdge';
import AnnotationNode, { type AnnotationNodeData } from './AnnotationNode';
import GroupBoxNode, { type GroupBoxNodeData } from './GroupBoxNode';

// ---------------------------------------------------------------------------
// Custom node / edge types — defined outside component to avoid ReactFlow remounting
// ---------------------------------------------------------------------------
const nodeTypes = { c4node: C4FlowNode, annotation: AnnotationNode, groupbox: GroupBoxNode };
const edgeTypes = { custom: CustomEdge };

// ---------------------------------------------------------------------------
// Visual element ID helpers (annotations use 'ann-' prefix, group boxes 'grp-')
// ---------------------------------------------------------------------------
const isAnnotationId = (id: string) => id.startsWith('ann-');
const isGroupBoxId = (id: string) => id.startsWith('grp-');

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
};

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

function toFlowNode(n: C4NodeData, selectedId: string | null): Node {
  const color = NODE_COLORS[n.type] ?? '#374151';
  const isSelected = selectedId === n.id;
  return {
    id: n.id,
    position: n.position,
    width: n.size.width,
    height: n.size.height,
    // Setting measured prevents ReactFlow from resetting handleBounds to undefined
    // on every setNodes call, which would cause edges to disappear until the
    // ResizeObserver fires again.
    measured: { width: n.size.width, height: n.size.height },
    data: {
      nodeType: n.type,
      label: n.label,
      description: n.description,
      technology: n.technology,
      childDiagramId: n.childDiagramId,
      color,
      isSelected,
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
    type: 'c4node',
  };
}

function toFlowAnnotation(a: C4Annotation, selectedId: string | null): Node {
  const isSelected = selectedId === a.id;
  return {
    id: a.id,
    position: a.position,
    width: a.size.width,
    height: a.size.height,
    measured: { width: a.size.width, height: a.size.height },
    data: {
      text: a.text,
      fontSize: a.fontSize,
      color: a.color,
      fontWeight: a.fontWeight,
      fontStyle: a.fontStyle,
      isSelected,
    } as AnnotationNodeData,
    style: {
      background: 'transparent',
      border: 'none',
      borderRadius: 0,
      padding: 0,
      overflow: 'visible',
    },
    type: 'annotation',
    zIndex: 10,
  };
}

function toFlowGroupBox(g: C4GroupBox, selectedId: string | null): Node {
  const isSelected = selectedId === g.id;
  return {
    id: g.id,
    position: g.position,
    width: g.size.width,
    height: g.size.height,
    measured: { width: g.size.width, height: g.size.height },
    data: {
      label: g.label,
      borderColor: g.borderColor,
      fillColor: g.fillColor,
      borderStyle: g.borderStyle,
      fontSize: g.fontSize,
      isSelected,
    } as GroupBoxNodeData,
    style: {
      background: 'transparent',
      border: 'none',
      borderRadius: 0,
      padding: 0,
      overflow: 'visible',
    },
    type: 'groupbox',
    zIndex: -1,
  };
}

function toFlowEdge(
  e: C4EdgeData,
  selectedId: string | null,
  callbacks: {
    onBendPointsChange: (edgeId: string, bendPoints: Array<{ x: number; y: number }>) => void;
    onLabelOffsetChange: (edgeId: string, offsetX: number, offsetY: number) => void;
    onAddBendPoint: (edgeId: string, index: number, point: { x: number; y: number }) => void;
  },
): Edge {
  const isSelected = selectedId === e.id;
  const strokeColor = isSelected ? '#facc15' : '#94a3b8';
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
    labelStyle: { fill: '#94a3b8', fontSize: 11 },
    labelBgStyle: { fill: '#1e293b' },
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

  const diagram = getActiveDiagram();

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

  useEffect(() => {
    if (!project || !activeDiagramId || restoringFromUrlRef.current) return;
    replaceStateInUrl({ project, activeDiagramId });
  }, [activeDiagramId, project]);

  const initialNodes = useMemo(
    () => [
      ...(diagram?.nodes ?? []).map((n) => toFlowNode(n, selectedNodeId)),
      ...(diagram?.annotations ?? []).map((a) => toFlowAnnotation(a, selectedNodeId)),
      ...(diagram?.groupBoxes ?? []).map((g) => toFlowGroupBox(g, selectedNodeId)),
    ],
    // Intentionally limited to diagram identity changes only; selection highlight
    // updates are handled separately via a dedicated useEffect to avoid full remounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeDiagramId, diagram?.id],
  );

  const initialEdges = useMemo(
    () => (diagram?.edges ?? []).map((e) => toFlowEdge(e, selectedEdgeId, edgeCallbacks)),
    // Same reasoning as initialNodes above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeDiagramId, diagram?.id],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when active diagram changes
  useEffect(() => {
    const d = getActiveDiagram();
    setNodes([
      ...(d?.nodes ?? []).map((n) => toFlowNode(n, selectedNodeId)),
      ...(d?.annotations ?? []).map((a) => toFlowAnnotation(a, selectedNodeId)),
      ...(d?.groupBoxes ?? []).map((g) => toFlowGroupBox(g, selectedNodeId)),
    ]);
    setEdges((d?.edges ?? []).map((e) => {
      const flowEdge = toFlowEdge(e, selectedEdgeId, edgeCallbacks);
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
    setNodes([
      ...(d?.nodes ?? []).map((n) => toFlowNode(n, selectedNodeId)),
      ...(d?.annotations ?? []).map((a) => toFlowAnnotation(a, selectedNodeId)),
      ...(d?.groupBoxes ?? []).map((g) => toFlowGroupBox(g, selectedNodeId)),
    ]);
    setEdges((d?.edges ?? []).map((e) => {
      const flowEdge = toFlowEdge(e, selectedEdgeId, edgeCallbacks);
      flowEdge.reconnectable = selectedEdgeId === e.id || reconnectingEdgeId === e.id;
      return flowEdge;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

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
        const strokeColor = selectedEdgeId === e.id ? '#facc15' : '#94a3b8';
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
  }, [diagram, reconnectingEdgeId, selectedEdgeId]);

  // Drag — update position in store (no snapshot to avoid cluttering history)
  const handleNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      for (const change of changes) {
        if (change.type === 'remove') {
          if (isAnnotationId(change.id)) removeAnnotation(change.id);
          else if (isGroupBoxId(change.id)) removeGroupBox(change.id);
          else removeNode(change.id);
        }
        if (change.type === 'position' && !change.dragging && change.position) {
          if (isAnnotationId(change.id)) updateAnnotationPosition(change.id, change.position.x, change.position.y);
          else if (isGroupBoxId(change.id)) updateGroupBoxPosition(change.id, change.position.x, change.position.y);
          else updateNodePosition(change.id, change.position.x, change.position.y);
        }
        if (change.type === 'dimensions' && change.dimensions && !change.resizing) {
          if (isAnnotationId(change.id)) updateAnnotationSize(change.id, change.dimensions.width, change.dimensions.height);
          else if (isGroupBoxId(change.id)) updateGroupBoxSize(change.id, change.dimensions.width, change.dimensions.height);
          else updateNodeSize(change.id, change.dimensions.width, change.dimensions.height);
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

      for (const change of changes) {
        if (change.type === 'remove') {
          removeEdge(change.id);
        }
      }
    },
    [onEdgesChange],
  );

  // Connect nodes — create edge in store
  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (selectedEdgeId) return;
      // Prevent connecting annotations or group boxes
      if (
        (connection.source && (isAnnotationId(connection.source) || isGroupBoxId(connection.source))) ||
        (connection.target && (isAnnotationId(connection.target) || isGroupBoxId(connection.target)))
      ) return;

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

  // Selection
  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (reconnectingRef.current) return;
    selectNode(node.id);
  }, []);

  const handleEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    selectEdge(edge.id);
  }, []);

  const handlePaneClick = useCallback(() => {
    if (reconnectingRef.current) return;
    clearSelection();
  }, []);

  // ---------------------------------------------------------------------------
  // Empty / no-project states
  // ---------------------------------------------------------------------------
  if (!project) {
    return (
      <div className="relative w-full h-full bg-gray-950 flex flex-col items-center justify-center select-none">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle, #6b7280 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative z-10 flex flex-col items-center gap-4 text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mb-2">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2h-2a2 2 0 01-2-2" />
            </svg>
          </div>
          <p className="text-gray-300 font-medium">No project open</p>
          <p className="text-gray-500 text-sm max-w-xs">
            Use <strong className="text-blue-400">New Project</strong> in the toolbar to create a project.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="diagram-canvas-container" style={{ width: '100%', height: '100%' }}>
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
        edgesReconnectable
        nodesConnectable={!selectedEdgeId}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'custom' }}
        fitView
        deleteKeyCode="Delete"
        colorMode="dark"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} color="#374151" />
        <Controls />
        <MiniMap nodeColor={(n) => (NODE_COLORS[(n.data as { nodeType?: string })?.nodeType ?? ''] ?? '#374151')} />
        <FitViewOnDiagramChange activeDiagramId={activeDiagramId} />
      </ReactFlow>
    </div>
  );
}
