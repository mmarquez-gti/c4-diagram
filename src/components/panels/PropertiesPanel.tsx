'use client';

import { useStore } from '@nanostores/react';
import { $project, $activeDiagramId, updateNode, updateEdge, enterSubdiagram } from '../../stores/diagramStore';
import { $selectedNodeId, $selectedEdgeId, clearSelection } from '../../stores/selectionStore';
import { $rightPanelOpen } from '../../stores/uiStore';
import type { C4NodeType } from '../../lib/c4/types';

const NODE_TYPES: C4NodeType[] = [
  'Person',
  'System',
  'SystemExt',
  'Boundary',
  'Container',
  'ContainerDb',
  'Component',
];

// ---------------------------------------------------------------------------
// Shared input styles
// ---------------------------------------------------------------------------

const inputClass =
  'bg-[#131826] text-[#d0daea] text-xs rounded px-2 py-1.5 border border-[#1e2a42] focus:outline-none focus:border-indigo-500 transition-colors w-full';

const labelClass = 'text-[11px] font-medium text-[#4a5a72] uppercase tracking-wider';

// ---------------------------------------------------------------------------
// Toggle button (sits on the left edge of the panel)
// ---------------------------------------------------------------------------

function ToggleButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={open ? 'Hide properties panel' : 'Show properties panel'}
      className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full w-4 h-8 flex items-center justify-center bg-[#0c0f1a] border border-r-0 border-[#1a2035] text-[#2a3550] hover:text-[#8b9ab0] hover:bg-[#161c2a] transition-colors z-20"
      style={{ borderRadius: '4px 0 0 4px' }}
    >
      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d={open ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
      </svg>
    </button>
  );
}

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
    <div className="relative flex shrink-0">
      <ToggleButton open={open} onToggle={() => $rightPanelOpen.set(!open)} />

      <aside
        className={`bg-[#0c0f1a] border-l border-[#1a2035] flex flex-col overflow-hidden transition-[width] duration-200 ease-out ${
          open ? 'w-64' : 'w-0'
        }`}
      >
        {/* Header */}
        <div className="px-3 py-2 text-[11px] font-semibold text-[#3a4a62] uppercase tracking-wider border-b border-[#1a2035] shrink-0 flex items-center justify-between whitespace-nowrap">
          <span>Properties</span>
          {(selectedNode || selectedEdge) && (
            <button
              onClick={() => clearSelection()}
              className="text-[#2a3550] hover:text-[#8b9ab0] transition-colors"
              title="Deselect"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

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

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Technology</span>
                <input
                  className={inputClass}
                  value={selectedNode.technology ?? ''}
                  onChange={(e) => updateNode(selectedNode.id, { technology: e.target.value || undefined })}
                />
              </label>

              <div className="mt-auto pt-3 border-t border-[#1a2035]">
                <button
                  className="w-full text-xs px-2 py-2 rounded bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-600/30 text-indigo-300 hover:text-indigo-200 transition-colors whitespace-nowrap"
                  onClick={() => enterSubdiagram(selectedNode.id)}
                  title="Drill into this node's sub-diagram"
                >
                  ↳ Enter Sub-diagram
                </button>
              </div>
            </>
          )}

          {selectedEdge && !selectedNode && (
            <>
              <p className="text-xs text-[#4a5a72] font-mono truncate">
                {selectedEdge.source} → {selectedEdge.target}
              </p>

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
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
