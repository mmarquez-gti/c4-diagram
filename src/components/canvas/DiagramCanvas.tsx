'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useStore } from '@nanostores/react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type Node,
  type Edge,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  $project,
  $activeDiagramId,
  $navigationStack,
  getActiveDiagram,
  updateNodePosition,
  addEdge as storeAddEdge,
  removeNode,
  removeEdge,
  goBack,
} from '../../stores/diagramStore';
import { $selectedNodeId, $selectedEdgeId, selectNode, selectEdge, clearSelection } from '../../stores/selectionStore';
import type { C4Node as C4NodeData, C4Edge as C4EdgeData } from '../../lib/c4/types';
import C4FlowNode from './C4FlowNode';

// ---------------------------------------------------------------------------
// Custom node types — defined outside component to avoid ReactFlow remounting
// ---------------------------------------------------------------------------
const nodeTypes = { c4node: C4FlowNode };

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
  return {
    id: n.id,
    position: n.position,
    data: {
      nodeType: n.type,
      label: n.label,
      description: n.description,
      technology: n.technology,
      childDiagramId: n.childDiagramId,
      color,
    },
    style: {
      background: color,
      color: '#fff',
      border: `2px solid ${selectedId === n.id ? '#facc15' : 'transparent'}`,
      borderRadius: 8,
      minWidth: n.size.width,
      minHeight: n.size.height,
      cursor: 'pointer',
      padding: 0,
    },
    type: 'c4node',
  };
}

function toFlowEdge(e: C4EdgeData, selectedId: string | null): Edge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label ?? undefined,
    style: {
      stroke: selectedId === e.id ? '#facc15' : '#94a3b8',
      strokeWidth: 1.5,
    },
    labelStyle: { fill: '#94a3b8', fontSize: 11 },
    labelBgStyle: { fill: '#1e293b' },
    markerEnd: { type: 'arrowclosed' as const, color: selectedId === e.id ? '#facc15' : '#94a3b8' },
  };
}

// ---------------------------------------------------------------------------
// Canvas component
// ---------------------------------------------------------------------------

export default function DiagramCanvas() {
  const project = useStore($project);
  const activeDiagramId = useStore($activeDiagramId);
  const selectedNodeId = useStore($selectedNodeId);
  const selectedEdgeId = useStore($selectedEdgeId);
  const navigationStack = useStore($navigationStack);

  const diagram = getActiveDiagram();

  // ---------------------------------------------------------------------------
  // Browser back-button support
  // Keep browser history in sync with the diagram navigation stack so that
  // pressing the browser Back button navigates to the parent diagram.
  // ---------------------------------------------------------------------------
  const prevNavLenRef = useRef<number>(navigationStack.length);
  const handlingPopstateRef = useRef(false);

  useEffect(() => {
    const handlePopstate = () => {
      handlingPopstateRef.current = true;
      goBack();
    };
    window.addEventListener('popstate', handlePopstate);
    // Stamp the root state so a back-press from depth>1 lands here, not off-page
    window.history.replaceState({ navDepth: navigationStack.length }, '');
    return () => window.removeEventListener('popstate', handlePopstate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const len = navigationStack.length;
    if (!handlingPopstateRef.current && len > prevNavLenRef.current) {
      // Navigated deeper via drill-down — push a new browser history entry
      window.history.pushState({ navDepth: len }, '');
    }
    handlingPopstateRef.current = false;
    prevNavLenRef.current = len;
  }, [navigationStack]);

  const initialNodes = useMemo(
    () => (diagram?.nodes ?? []).map((n) => toFlowNode(n, selectedNodeId)),
    // Intentionally limited to diagram identity changes only; selection highlight
    // updates are handled separately via a dedicated useEffect to avoid full remounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeDiagramId, diagram?.id],
  );

  const initialEdges = useMemo(
    () => (diagram?.edges ?? []).map((e) => toFlowEdge(e, selectedEdgeId)),
    // Same reasoning as initialNodes above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeDiagramId, diagram?.id],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when active diagram changes
  useEffect(() => {
    const d = getActiveDiagram();
    setNodes((d?.nodes ?? []).map((n) => toFlowNode(n, selectedNodeId)));
    setEdges((d?.edges ?? []).map((e) => toFlowEdge(e, selectedEdgeId)));
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
    setNodes((d?.nodes ?? []).map((n) => toFlowNode(n, selectedNodeId)));
    setEdges((d?.edges ?? []).map((e) => toFlowEdge(e, selectedEdgeId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  // Update selection highlights
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        style: {
          ...n.style,
          border: `2px solid ${selectedNodeId === n.id ? '#facc15' : 'transparent'}`,
        },
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId]);

  useEffect(() => {
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        style: {
          ...e.style,
          stroke: selectedEdgeId === e.id ? '#facc15' : '#94a3b8',
        },
        markerEnd: { type: 'arrowclosed' as const, color: selectedEdgeId === e.id ? '#facc15' : '#94a3b8' },
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEdgeId]);

  // Drag — update position in store (no snapshot to avoid cluttering history)
  const handleNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      for (const change of changes) {
        if (change.type === 'position' && !change.dragging && change.position) {
          updateNodePosition(change.id, change.position.x, change.position.y);
        }
      }
    },
    [onNodesChange],
  );

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
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
      setEdges((eds) => addEdge(connection, eds));
      if (connection.source && connection.target) {
        storeAddEdge(connection.source, connection.target);
      }
    },
    [setEdges],
  );

  // Selection
  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    selectNode(node.id);
  }, []);

  const handleEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    selectEdge(edge.id);
  }, []);

  const handlePaneClick = useCallback(() => {
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
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode="Delete"
        colorMode="dark"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} color="#374151" />
        <Controls />
        <MiniMap nodeColor={(n) => (NODE_COLORS[(n.data as { nodeType?: string })?.nodeType ?? ''] ?? '#374151')} />
      </ReactFlow>
    </div>
  );
}
