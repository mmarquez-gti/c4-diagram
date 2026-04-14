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
  'text-xs rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 transition-colors w-full';

const labelClass = 'text-[11px] font-medium uppercase tracking-wider';

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
      className={`relative flex flex-col shrink-0 overflow-hidden transition-[width] duration-200 ease-out ${
        open ? 'w-64' : 'w-8'
      }`}
      style={{
        backgroundColor: 'var(--c4-panel-bg)',
        borderLeft: '1px solid var(--c4-border)',
      }}
    >
      {/* Header row — always visible */}
      <div
        className="flex items-center h-8 shrink-0"
        style={{ borderBottom: '1px solid var(--c4-border)' }}
      >
        {open ? (
          <>
            <button
              onClick={() => $rightPanelOpen.set(false)}
              title="Collapse properties panel"
              className="w-8 h-full flex items-center justify-center transition-colors shrink-0"
              style={{ color: 'var(--c4-text-faint)' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = 'var(--c4-text-secondary)';
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--c4-panel-hover)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = 'var(--c4-text-faint)';
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <span
              className="flex-1 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
              style={{ color: 'var(--c4-text-faint)' }}
            >
              Properties
            </span>
            {(selectedNode || selectedEdge) && (
              <button
                onClick={() => clearSelection()}
                className="mr-2 transition-colors"
                style={{ color: 'var(--c4-text-faint)' }}
                title="Deselect"
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--c4-text-secondary)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--c4-text-faint)';
                }}
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
            className="w-full h-full flex items-center justify-center transition-colors"
            style={{ color: 'var(--c4-text-faint)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--c4-text-secondary)';
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--c4-panel-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--c4-text-faint)';
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
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
            <p
              className="text-xs italic mt-2 whitespace-nowrap"
              style={{ color: 'var(--c4-text-faint)' }}
            >
              Select a node or edge
            </p>
          )}

          {selectedNode && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass} style={{ color: 'var(--c4-text-muted)' }}>Type</span>
                <select
                  className={inputClass}
                  style={{
                    backgroundColor: 'var(--c4-secondary-bg)',
                    color: 'var(--c4-text-primary)',
                    border: '1px solid var(--c4-border-strong)',
                  }}
                  value={selectedNode.type}
                  onChange={(e) => updateNode(selectedNode.id, { type: e.target.value as C4NodeType })}
                >
                  {NODE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass} style={{ color: 'var(--c4-text-muted)' }}>Label</span>
                <input
                  className={inputClass}
                  style={{
                    backgroundColor: 'var(--c4-secondary-bg)',
                    color: 'var(--c4-text-primary)',
                    border: '1px solid var(--c4-border-strong)',
                  }}
                  value={selectedNode.label}
                  placeholder="Label…"
                  onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass} style={{ color: 'var(--c4-text-muted)' }}>Description</span>
                <textarea
                  className={`${inputClass} resize-none`}
                  style={{
                    backgroundColor: 'var(--c4-secondary-bg)',
                    color: 'var(--c4-text-primary)',
                    border: '1px solid var(--c4-border-strong)',
                  }}
                  rows={3}
                  value={selectedNode.description ?? ''}
                  placeholder="Description…"
                  onChange={(e) => updateNode(selectedNode.id, { description: e.target.value || undefined })}
                />
              </label>

              {selectedNode.type !== 'TextLabel' && selectedNode.type !== 'GroupBox' && (
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass} style={{ color: 'var(--c4-text-muted)' }}>Technology</span>
                  <input
                    className={inputClass}
                    style={{
                      backgroundColor: 'var(--c4-secondary-bg)',
                      color: 'var(--c4-text-primary)',
                      border: '1px solid var(--c4-border-strong)',
                    }}
                    value={selectedNode.technology ?? ''}
                    onChange={(e) => updateNode(selectedNode.id, { technology: e.target.value || undefined })}
                  />
                </label>
              )}

              {selectedNode.type !== 'TextLabel' && selectedNode.type !== 'GroupBox' && (
                <div className="flex flex-col gap-1.5">
                  <span className={labelClass} style={{ color: 'var(--c4-text-muted)' }}>Display</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!selectedNode.hideIcon}
                      onChange={(e) => updateNode(selectedNode.id, { hideIcon: e.target.checked || undefined })}
                      className="rounded"
                    />
                    <span className="text-xs" style={{ color: 'var(--c4-text-secondary)' }}>Hide icon</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!selectedNode.hideTypeLabel}
                      onChange={(e) => updateNode(selectedNode.id, { hideTypeLabel: e.target.checked || undefined })}
                      className="rounded"
                    />
                    <span className="text-xs" style={{ color: 'var(--c4-text-secondary)' }}>Hide type name</span>
                  </label>
                </div>
              )}

              {(selectedNode.type === 'TextLabel' || selectedNode.type === 'GroupBox') && (
                <div className="flex flex-col gap-1.5">
                  <span className={labelClass} style={{ color: 'var(--c4-text-muted)' }}>Color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedNode.color ?? (selectedNode.type === 'GroupBox' ? '#6366f1' : '#e2e8f0')}
                      onChange={(e) => updateNode(selectedNode.id, { color: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent"
                      style={{ border: '1px solid var(--c4-border-strong)' }}
                      title="Pick color"
                    />
                    <span
                      className="text-[11px] font-mono"
                      style={{ color: 'var(--c4-text-muted)' }}
                    >
                      {selectedNode.color ?? (selectedNode.type === 'GroupBox' ? '#6366f1' : '#e2e8f0')}
                    </span>
                    {selectedNode.color && (
                      <button
                        onClick={() => updateNode(selectedNode.id, { color: undefined })}
                        className="text-[10px] transition-colors"
                        style={{ color: 'var(--c4-text-muted)' }}
                        title="Reset to default"
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.color = 'var(--c4-text-secondary)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.color = 'var(--c4-text-muted)';
                        }}
                      >
                        ↺
                      </button>
                    )}
                  </div>
                </div>
              )}

              {selectedNode.type !== 'TextLabel' && (
                <div className="flex flex-col gap-1.5">
                  <span className={labelClass} style={{ color: 'var(--c4-text-muted)' }}>Text Color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedNode.textColor ?? '#ffffff'}
                      onChange={(e) => updateNode(selectedNode.id, { textColor: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent"
                      style={{ border: '1px solid var(--c4-border-strong)' }}
                      title="Pick text color"
                    />
                    <span
                      className="text-[11px] font-mono"
                      style={{ color: 'var(--c4-text-muted)' }}
                    >
                      {selectedNode.textColor ?? '#ffffff'}
                    </span>
                    {selectedNode.textColor && (
                      <button
                        onClick={() => updateNode(selectedNode.id, { textColor: undefined })}
                        className="text-[10px] transition-colors"
                        style={{ color: 'var(--c4-text-muted)' }}
                        title="Reset to default"
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.color = 'var(--c4-text-secondary)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.color = 'var(--c4-text-muted)';
                        }}
                      >
                        ↺
                      </button>
                    )}
                  </div>
                </div>
              )}

              {selectedNode.type !== 'TextLabel' && selectedNode.type !== 'GroupBox' && (
                <div
                  className="mt-auto pt-3"
                  style={{ borderTop: '1px solid var(--c4-border)' }}
                >
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
              <p
                className="text-xs font-mono truncate"
                style={{ color: 'var(--c4-text-muted)' }}
              >
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
                <span className={labelClass} style={{ color: 'var(--c4-text-muted)' }}>Path Mode</span>
                <div className="flex flex-col gap-1">
                  {EDGE_PATH_MODES.map((mode) => (
                    <button
                      key={mode.value}
                      className="flex items-center gap-2 text-xs px-2 py-1.5 rounded border transition-colors"
                      style={
                        (selectedEdge.pathMode ?? 'bezier') === mode.value
                          ? {
                              backgroundColor: 'rgba(99,102,241,0.3)',
                              borderColor: 'rgb(99,102,241)',
                              color: '#c7d2fe',
                            }
                          : {
                              backgroundColor: 'var(--c4-secondary-bg)',
                              borderColor: 'var(--c4-border-strong)',
                              color: 'var(--c4-text-muted)',
                            }
                      }
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
                <span className={labelClass} style={{ color: 'var(--c4-text-muted)' }}>Direction</span>
                <select
                  className={inputClass}
                  style={{
                    backgroundColor: 'var(--c4-secondary-bg)',
                    color: 'var(--c4-text-primary)',
                    border: '1px solid var(--c4-border-strong)',
                  }}
                  value={selectedEdge.direction ?? 'forward'}
                  onChange={(e) => updateEdge(selectedEdge.id, { direction: e.target.value as C4EdgeDirection })}
                >
                  {EDGE_DIRECTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass} style={{ color: 'var(--c4-text-muted)' }}>Label</span>
                <input
                  className={inputClass}
                  style={{
                    backgroundColor: 'var(--c4-secondary-bg)',
                    color: 'var(--c4-text-primary)',
                    border: '1px solid var(--c4-border-strong)',
                  }}
                  value={selectedEdge.label ?? ''}
                  onChange={(e) => updateEdge(selectedEdge.id, { label: e.target.value || undefined })}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass} style={{ color: 'var(--c4-text-muted)' }}>Technology</span>
                <input
                  className={inputClass}
                  style={{
                    backgroundColor: 'var(--c4-secondary-bg)',
                    color: 'var(--c4-text-primary)',
                    border: '1px solid var(--c4-border-strong)',
                  }}
                  value={selectedEdge.technology ?? ''}
                  onChange={(e) => updateEdge(selectedEdge.id, { technology: e.target.value || undefined })}
                />
              </label>

              {/* Label offset reset */}
              {((selectedEdge.labelOffsetX ?? 0) !== 0 || (selectedEdge.labelOffsetY ?? 0) !== 0) && (
                <div className="flex flex-col gap-1.5">
                  <span className={labelClass} style={{ color: 'var(--c4-text-muted)' }}>Label Position</span>
                  <button
                    className="text-xs px-2 py-1 rounded transition-colors"
                    style={{
                      backgroundColor: 'var(--c4-secondary-bg)',
                      border: '1px solid var(--c4-border-strong)',
                      color: 'var(--c4-text-muted)',
                    }}
                    onClick={() => updateEdge(selectedEdge.id, { labelOffsetX: 0, labelOffsetY: 0 })}
                    title="Reset label to default position"
                  >
                    ↺ Reset label position
                  </button>
                </div>
              )}

              {/* Bend points info & controls */}
              <div className="flex flex-col gap-1.5">
                <span className={labelClass} style={{ color: 'var(--c4-text-muted)' }}>
                  Bend Points ({(selectedEdge.bendPoints ?? []).length})
                </span>
                <p
                  className="text-[10px] leading-tight"
                  style={{ color: 'var(--c4-text-faint)' }}
                >
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
