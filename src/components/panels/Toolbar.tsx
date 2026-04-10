'use client';

import { useEffect } from 'react';
import { useStore } from '@nanostores/react';
import {
  $project,
  $activeDiagramId,
  $navigationStack,
  $checkpointSaved,
  createProject,
  loadProject,
  addNode,
  goBack,
  navigateTo,
  undo,
  redo,
} from '../../stores/diagramStore';
import { $history } from '../../stores/historyStore';
import { serializeProject } from '../../lib/mermaid/serializer';
import type { C4NodeType } from '../../lib/c4/types';

const ADD_NODE_TYPES: { type: C4NodeType; label: string }[] = [
  { type: 'Person', label: 'Person' },
  { type: 'System', label: 'System' },
  { type: 'SystemExt', label: 'Ext. System' },
  { type: 'Container', label: 'Container' },
  { type: 'ContainerDb', label: 'Database' },
  { type: 'Component', label: 'Component' },
];

function downloadFile(name: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Toolbar() {
  const project = useStore($project);
  const activeDiagramId = useStore($activeDiagramId);
  const navigationStack = useStore($navigationStack);
  const history = useStore($history);
  const checkpointSaved = useStore($checkpointSaved);

  // Auto-clear the checkpoint indicator after 1.5 s
  useEffect(() => {
    if (!checkpointSaved) return;
    const timer = setTimeout(() => $checkpointSaved.set(false), 1500);
    return () => clearTimeout(timer);
  }, [checkpointSaved]);

  const canUndo = history.past.length > 0;
  const canGoBack = navigationStack.length > 1;

  const handleNewProject = () => {
    const name = prompt('Project name:', 'My C4 Project');
    if (name !== null) createProject(name || 'My C4 Project');
  };

  const handleAddNode = (type: C4NodeType) => {
    if (!project) {
      createProject();
    }
    addNode({ type, label: type, x: 120 + Math.random() * 300, y: 80 + Math.random() * 200 });
  };

  const handleExportMermaid = () => {
    if (!project) return;
    const mmd = serializeProject(project.diagrams, project.rootDiagramId);
    downloadFile(`${project.name}.mmd`, mmd, 'text/plain');
  };

  const handleExportJson = () => {
    if (!project) return;
    downloadFile(`${project.name}.c4m`, JSON.stringify(project, null, 2), 'application/json');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.c4m,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        loadProject(data);
      } catch {
        alert('Failed to load project file. Please check the file format.');
      }
    };
    input.click();
  };

  const diagram = project && activeDiagramId ? project.diagrams[activeDiagramId] : null;

  return (
    <header className="flex items-center gap-2 bg-gray-900 border-b border-gray-700 px-4 py-2 shrink-0 flex-wrap">
      {/* Brand */}
      <span className="font-semibold text-blue-400 tracking-wide mr-2 shrink-0">C4 Diagram Creator</span>

      {/* Project actions */}
      <div className="flex items-center gap-1 border-r border-gray-700 pr-2 mr-1">
        <button
          onClick={handleNewProject}
          className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 transition-colors"
          title="New project"
        >
          + New
        </button>
        <button
          onClick={handleImport}
          className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 transition-colors"
          title="Import .c4m project"
        >
          Import
        </button>
      </div>

      {/* Add node */}
      <div className="flex items-center gap-1 border-r border-gray-700 pr-2 mr-1">
        {ADD_NODE_TYPES.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => handleAddNode(type)}
            className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 transition-colors"
            title={`Add ${type}`}
          >
            + {label}
          </button>
        ))}
      </div>

      {/* Undo / Redo */}
      <div className="flex items-center gap-1 border-r border-gray-700 pr-2 mr-1">
        <button
          onClick={undo}
          disabled={!canUndo}
          className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Undo (Ctrl+Z)"
        >
          ↩ Undo
        </button>
        <button
          onClick={redo}
          disabled={history.future.length === 0}
          className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Redo (Ctrl+Y)"
        >
          ↪ Redo
        </button>
      </div>

      {/* Navigation breadcrumb */}
      {project && navigationStack.length > 0 && (
        <div className="flex items-center gap-1 border-r border-gray-700 pr-2 mr-1 text-xs">
          {navigationStack.map((diagId, i) => {
            const d = project.diagrams[diagId];
            const isLast = i === navigationStack.length - 1;
            return (
              <span key={diagId} className="flex items-center gap-1">
                {i > 0 && <span className="text-gray-600">/</span>}
                <button
                  onClick={() => navigateTo(i)}
                  className={`px-1 py-0.5 rounded transition-colors ${
                    isLast
                      ? 'text-blue-300 font-semibold cursor-default'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {d?.title ?? diagId}
                </button>
              </span>
            );
          })}
        </div>
      )}

      {canGoBack && (
        <button
          onClick={goBack}
          className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 transition-colors"
          title="Go back"
        >
          ← Back
        </button>
      )}

      <div className="flex-1" />

      {/* Export */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleExportMermaid}
          disabled={!project}
          className="px-2 py-1 text-xs rounded bg-teal-700 hover:bg-teal-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Export as Mermaid (.mmd)"
        >
          Export Mermaid
        </button>
        <button
          onClick={handleExportJson}
          disabled={!project}
          className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Export as project (.c4m)"
        >
          Export .c4m
        </button>
      </div>

      {/* Diagram info */}
      {diagram && (
        <span className="text-xs text-gray-500 ml-2 shrink-0">
          {diagram.title}
        </span>
      )}

      {/* Ctrl+S checkpoint saved indicator */}
      {checkpointSaved && (
        <span className="text-xs text-green-400 ml-2 shrink-0 transition-opacity">
          ✓ Checkpoint saved
        </span>
      )}
    </header>
  );
}
