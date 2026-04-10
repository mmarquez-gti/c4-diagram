'use client';

import { useStore } from '@nanostores/react';
import { $project, $activeDiagramId, jumpToDiagram } from '../../stores/diagramStore';
import type { C4Project } from '../../lib/c4/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface DiagramTreeNode {
  id: string;
  title: string;
  depth: number;
  children: DiagramTreeNode[];
}

function buildTree(project: C4Project): DiagramTreeNode {
  function build(diagramId: string): DiagramTreeNode {
    const diag = project.diagrams[diagramId];
    if (!diag) return { id: diagramId, title: diagramId, depth: 0, children: [] };
    const children: DiagramTreeNode[] = [];
    for (const node of diag.nodes) {
      if (node.childDiagramId && project.diagrams[node.childDiagramId]) {
        children.push(build(node.childDiagramId));
      }
    }
    return { id: diagramId, title: diag.title, depth: diag.depth, children };
  }
  return build(project.rootDiagramId);
}

// ---------------------------------------------------------------------------
// Tree node component
// ---------------------------------------------------------------------------

interface TreeItemProps {
  node: DiagramTreeNode;
  activeDiagramId: string | null;
  indent: number;
}

function TreeItem({ node, activeDiagramId, indent }: TreeItemProps) {
  const isActive = node.id === activeDiagramId;
  return (
    <>
      <button
        onClick={() => jumpToDiagram(node.id)}
        title={node.title}
        className={`w-full text-left text-xs px-2 py-1.5 rounded truncate transition-colors ${
          isActive
            ? 'bg-blue-600 text-white font-semibold'
            : 'text-gray-300 hover:bg-gray-700 hover:text-white'
        }`}
        style={{ paddingLeft: `${8 + indent * 12}px` }}
      >
        {indent > 0 && <span className="text-gray-500 mr-1">{'›'}</span>}
        {node.title}
      </button>
      {node.children.map((child) => (
        <TreeItem key={child.id} node={child} activeDiagramId={activeDiagramId} indent={indent + 1} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Panel component
// ---------------------------------------------------------------------------

export default function DiagramsPanel() {
  const project = useStore($project);
  const activeDiagramId = useStore($activeDiagramId);

  if (!project) {
    return (
      <aside className="w-48 bg-gray-900 border-r border-gray-700 flex flex-col shrink-0">
        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-700">
          Diagrams
        </div>
        <p className="text-xs text-gray-600 p-3">No project open</p>
      </aside>
    );
  }

  const tree = buildTree(project);

  return (
    <aside className="w-48 bg-gray-900 border-r border-gray-700 flex flex-col shrink-0 overflow-y-auto">
      <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-700 shrink-0">
        Diagrams
      </div>
      <div className="flex flex-col gap-0.5 p-1.5">
        <TreeItem node={tree} activeDiagramId={activeDiagramId} indent={0} />
      </div>
    </aside>
  );
}
