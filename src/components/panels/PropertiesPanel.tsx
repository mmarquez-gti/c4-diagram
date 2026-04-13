'use client';

import { useStore } from '@nanostores/react';
import { $project, $activeDiagramId, updateNode, updateEdge, enterSubdiagram } from '../../stores/diagramStore';
import { $selectedNodeId, $selectedEdgeId, clearSelection } from '../../stores/selectionStore';
import { $rightPanelOpen } from '../../stores/uiStore';
import type { C4EdgeDirection, C4EdgePathMode, C4NodeType } from '../../lib/c4/types';

const NODE_TYPES: C4NodeType[] = [
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

const EDGE_DIRECTIONS: Array<{ value: C4EdgeDirection; label: string }> = [
  { value: 'forward', label: 'Source -> Target' },
  { value: 'reverse', label: 'Target -> Source' },
  { value: 'bidirectional', label: 'Bidirectional' },
  { value: 'none', label: 'No arrows' },
];

const EDGE_PATH_MODES: Array<{ value: C4EdgePathMode; label: string; icon: string }> = [
  { value: 'bezier', label: 'Curved', icon: '⌒' },
  { value: 'straight', label: 'Straight', icon: '⟋' },
  { value: 'orthogonal', label: 'Orthogonal', icon: '⌐' },
];

// ---------------------------------------------------------------------------
// Shared input styles
// ---------------------------------------------------------------------------

const inputClass =
  'bg-[#131826] text-[#d0daea] text-xs rounded px-2 py-1.5 border border-[#1e2a42] focus:outline-none focus:border-indigo-500 transition-colors w-full';

const labelClass = 'text-[11px] font-medium text-[#4a5a72] uppercase tracking-wider';

// ---------------------------------------------------------------------------
// PropertiesPanel
// ---------------------------------------------------------------------------

export default function PropertiesPanel() {
  const project = useStore($project);
  const activeDiagramId = useStore($activeDiagramId);
  const selectedNodeId = useStore($selectedNodeId);
  const selectedEdgeId = useStore($selectedEdgeId);
  const open = useStore($rightPanelOpen);

  const diagram = project && activeDiagramId ? project.diagrams[activeDiagramId] : null;
  const selectedNode = diagram?.nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedEdge = diagram?.edges.find((e) => e.id === selectedEdgeId) ?? null;

  return (
    <div
      className={`relative flex flex-col shrink-0 bg-[#0c0f1a] border-l border-[#1a2035] overflow-hidden transition-[width] duration-200 ease-out ${
        open ? 'w-64' : 'w-8'
      }`}
    >
      {/* Header row — always visible */}
      <div className="flex items-center border-b border-[#1a2035] h-8 shrink-0">
        {open ? (
          <>
            <button
              onClick={() => $rightPanelOpen.set(false)}
              title="Collapse properties panel"
              className="w-8 h-full flex items-center justify-center text-[#2a3550] hover:text-[#8b9ab0] hover:bg-[#161c2a] transition-colors shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <span className="flex-1 text-[11px] font-semibold text-[#3a4a62] uppercase tracking-wider whitespace-nowrap">
              Properties
            </span>
            {(selectedNode || selectedEdge) && (
              <button
                onClick={() => clearSelection()}
                className="mr-2 text-[#2a3550] hover:text-[#8b9ab0] transition-colors"
                title="Deselect"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </>
        ) : (
          <button
            onClick={() => $rightPanelOpen.set(true)}
            title="Expand properties panel"
            className="w-full h-full flex items-center justify-center text-[#2a3550] hover:text-[#8b9ab0] hover:bg-[#161c2a] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Content — only visible when open */}
      {open && (
        <div className="flex flex-col gap-4 p-3 overflow-y-auto flex-1 min-w-0">
          {!selectedNode && !selectedEdge && (
            <p className="text-xs text-[#2a3a52] italic mt-2 whitespace-nowrap">
              Select a node or edge
            </p>
          )}

          {selectedNode && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Type</span>
                <select
                  className={inputClass}
                  value={selectedNode.type}
                  onChange={(e) => updateNode(selectedNode.id, { type: e.target.value as C4NodeType })}
                >
                  {NODE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Label</span>
                <input
                  className={inputClass}
                  value={selectedNode.label}
                  onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Description</span>
                <textarea
                  className={`${inputClass} resize-none`}
                  rows={3}
                  value={selectedNode.description ?? ''}
                  onChange={(e) => updateNode(selectedNode.id, { description: e.target.value || undefined })}
                />
              </label>

              {selectedNode.type !== 'TextLabel' && selectedNode.type !== 'GroupBox' && (
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Technology</span>
                  <input
                    className={inputClass}
                    value={selectedNode.technology ?? ''}
                    onChange={(e) => updateNode(selectedNode.id, { technology: e.target.value || undefined })}
                  />
                </label>
              )}

              {(selectedNode.type === 'TextLabel' || selectedNode.type === 'GroupBox') && (
                <div className="flex flex-col gap-1.5">
                  <span className={labelClass}>Color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedNode.color ?? (selectedNode.type === 'GroupBox' ? '#6366f1' : '#e2e8f0')}
                      onChange={(e) => updateNode(selectedNode.id, { color: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer border border-[#1e2a42] bg-transparent"
                      title="Pick color"
                    />
                    <span className="text-[11px] text-[#4a5a72] font-mono">
                      {selectedNode.color ?? (selectedNode.type === 'GroupBox' ? '#6366f1' : '#e2e8f0')}
                    </span>
                    {selectedNode.color && (
                      <button
                        onClick={() => updateNode(selectedNode.id, { color: undefined })}
                        className="text-[10px] text-[#4a5a72] hover:text-[#8b9ab0] transition-colors"
                        title="Reset to default"
                      >
                        ↺
                      </button>
                    )}
                  </div>
                </div>
              )}

              {selectedNode.type !== 'TextLabel' && selectedNode.type !== 'GroupBox' && (
                <div className="mt-auto pt-3 border-t border-[#1a2035]">
                  <button
                    className="w-full text-xs px-2 py-2 rounded bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-600/30 text-indigo-300 hover:text-indigo-200 transition-colors whitespace-nowrap"
                    onClick={() => enterSubdiagram(selectedNode.id)}
                    title="Drill into this node's sub-diagram"
                  >
                    ↳ Enter Sub-diagram
                  </button>
                </div>
              )}
            </>
          )}

          {selectedEdge && !selectedNode && (
            <>
              <p className="text-xs text-[#4a5a72] font-mono truncate">
                {selectedEdge.source}{' '}
                {selectedEdge.direction === 'reverse'
                  ? '←'
                  : selectedEdge.direction === 'bidirectional'
                    ? '↔'
                    : selectedEdge.direction === 'none'
                      ? '—'
                      : '→'}{' '}
                {selectedEdge.target}
              </p>

              {/* Path mode selector */}
              <div className="flex flex-col gap-1.5">
                <span className={labelClass}>Path Mode</span>
                <div className="flex flex-col gap-1">
                  {EDGE_PATH_MODES.map((mode) => (
                    <button
                      key={mode.value}
                      className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded border transition-colors ${
                        (selectedEdge.pathMode ?? 'bezier') === mode.value
                          ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                          : 'bg-[#131826] border-[#1e2a42] text-[#4a5a72] hover:border-[#2a3a52] hover:text-[#8b9ab0]'
                      }`}
                      onClick={() => updateEdge(selectedEdge.id, { pathMode: mode.value })}
                      title={mode.label}
                      aria-label={`${mode.label} path mode`}
                    >
                      <span>{mode.icon}</span>
                      <span>{mode.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Direction</span>
                <select
                  className={inputClass}
                  value={selectedEdge.direction ?? 'forward'}
                  onChange={(e) => updateEdge(selectedEdge.id, { direction: e.target.value as C4EdgeDirection })}
                >
                  {EDGE_DIRECTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Label</span>
                <input
                  className={inputClass}
                  value={selectedEdge.label ?? ''}
                  onChange={(e) => updateEdge(selectedEdge.id, { label: e.target.value || undefined })}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Technology</span>
                <input
                  className={inputClass}
                  value={selectedEdge.technology ?? ''}
                  onChange={(e) => updateEdge(selectedEdge.id, { technology: e.target.value || undefined })}
                />
              </label>

              {/* Label offset reset */}
              {((selectedEdge.labelOffsetX ?? 0) !== 0 || (selectedEdge.labelOffsetY ?? 0) !== 0) && (
                <div className="flex flex-col gap-1.5">
                  <span className={labelClass}>Label Position</span>
                  <button
                    className="text-xs px-2 py-1 rounded bg-[#131826] hover:bg-[#1a2230] border border-[#1e2a42] text-[#4a5a72] hover:text-[#8b9ab0] transition-colors"
                    onClick={() => updateEdge(selectedEdge.id, { labelOffsetX: 0, labelOffsetY: 0 })}
                    title="Reset label to default position"
                  >
                    ↺ Reset label position
                  </button>
                </div>
              )}

              {/* Bend points info & controls */}
              <div className="flex flex-col gap-1.5">
                <span className={labelClass}>
                  Bend Points ({(selectedEdge.bendPoints ?? []).length})
                </span>
                <p className="text-[10px] text-[#3a4a62] leading-tight">
                  Double-click on the edge to add a bend point. Double-click a point to remove it. Drag to reposition.
                </p>
                {(selectedEdge.bendPoints ?? []).length > 0 && (
                  <button
                    className="text-xs px-2 py-1 rounded bg-red-600/20 hover:bg-red-600/40 border border-red-600/30 text-red-300 hover:text-red-200 transition-colors"
                    onClick={() => updateEdge(selectedEdge.id, { bendPoints: [] })}
                  >
                    Clear All Bend Points
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
