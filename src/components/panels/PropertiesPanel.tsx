'use client';

import { useStore } from '@nanostores/react';
import { $project, $activeDiagramId, updateNode, updateEdge, enterSubdiagram } from '../../stores/diagramStore';
import { $selectedNodeId, $selectedEdgeId, clearSelection } from '../../stores/selectionStore';
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

export default function PropertiesPanel() {
  const project = useStore($project);
  const activeDiagramId = useStore($activeDiagramId);
  const selectedNodeId = useStore($selectedNodeId);
  const selectedEdgeId = useStore($selectedEdgeId);

  const diagram = project && activeDiagramId ? project.diagrams[activeDiagramId] : null;
  const selectedNode = diagram?.nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedEdge = diagram?.edges.find((e) => e.id === selectedEdgeId) ?? null;

  if (!selectedNode && !selectedEdge) {
    return (
      <div className="flex flex-col h-full">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Properties
        </p>
        <p className="text-xs text-gray-500 italic">Select a node or edge to edit its properties.</p>
      </div>
    );
  }

  if (selectedNode) {
    return (
      <div className="flex flex-col h-full gap-3 overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Node Properties
          </p>
          <button
            onClick={() => clearSelection()}
            className="text-gray-500 hover:text-gray-300 text-xs"
            title="Deselect"
          >
            ✕
          </button>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400">Type</span>
          <select
            className="bg-gray-800 text-white text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none focus:border-blue-500"
            value={selectedNode.type}
            onChange={(e) => updateNode(selectedNode.id, { type: e.target.value as C4NodeType })}
          >
            {NODE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400">Label</span>
          <input
            className="bg-gray-800 text-white text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none focus:border-blue-500"
            value={selectedNode.label}
            onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400">Description</span>
          <textarea
            className="bg-gray-800 text-white text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none focus:border-blue-500 resize-none"
            rows={3}
            value={selectedNode.description ?? ''}
            onChange={(e) => updateNode(selectedNode.id, { description: e.target.value || undefined })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400">Technology</span>
          <input
            className="bg-gray-800 text-white text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none focus:border-blue-500"
            value={selectedNode.technology ?? ''}
            onChange={(e) => updateNode(selectedNode.id, { technology: e.target.value || undefined })}
          />
        </label>

        <div className="mt-auto pt-2 border-t border-gray-700">
          <button
            className="w-full text-xs px-2 py-1.5 rounded bg-blue-700 hover:bg-blue-600 transition-colors text-white"
            onClick={() => enterSubdiagram(selectedNode.id)}
            title="Drill into this node's sub-diagram"
          >
            ↳ Enter Sub-diagram
          </button>
        </div>
      </div>
    );
  }

  // Edge selected
  return (
    <div className="flex flex-col h-full gap-3 overflow-y-auto">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Edge Properties
        </p>
        <button
          onClick={() => clearSelection()}
          className="text-gray-500 hover:text-gray-300 text-xs"
          title="Deselect"
        >
          ✕
        </button>
      </div>

      <p className="text-xs text-gray-500">
        {selectedEdge!.source} → {selectedEdge!.target}
      </p>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-400">Label</span>
        <input
          className="bg-gray-800 text-white text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none focus:border-blue-500"
          value={selectedEdge!.label ?? ''}
          onChange={(e) => updateEdge(selectedEdge!.id, { label: e.target.value || undefined })}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-400">Technology</span>
        <input
          className="bg-gray-800 text-white text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none focus:border-blue-500"
          value={selectedEdge!.technology ?? ''}
          onChange={(e) => updateEdge(selectedEdge!.id, { technology: e.target.value || undefined })}
        />
      </label>
    </div>
  );
}
