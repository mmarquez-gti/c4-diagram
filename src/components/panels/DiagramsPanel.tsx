'use client';

import { useStore } from '@nanostores/react';
import { $project, $activeDiagramId, jumpToDiagram } from '../../stores/diagramStore';
import { $leftPanelOpen } from '../../stores/uiStore';
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
            ? 'bg-indigo-600/80 text-white font-semibold'
            : 'text-[#8b9ab0] hover:bg-[#161c2a] hover:text-white'
        }`}
        style={{ paddingLeft: `${8 + indent * 12}px` }}
      >
        {indent > 0 && <span className="text-[#2a3550] mr-1">›</span>}
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
  const open = useStore($leftPanelOpen);

  return (
    <div
      className={`relative flex flex-col shrink-0 bg-[#0c0f1a] border-r border-[#1a2035] overflow-hidden transition-[width] duration-200 ease-out ${
        open ? 'w-48' : 'w-8'
      }`}
    >
      {/* Header row — always visible */}
      <div className="flex items-center border-b border-[#1a2035] h-8 shrink-0">
        {open ? (
          <>
            <span className="flex-1 pl-3 text-[11px] font-semibold text-[#3a4a62] uppercase tracking-wider whitespace-nowrap">
              Diagrams
            </span>
            <button
              onClick={() => $leftPanelOpen.set(false)}
              title="Collapse diagrams panel"
              className="w-8 h-full flex items-center justify-center text-[#2a3550] hover:text-[#8b9ab0] hover:bg-[#161c2a] transition-colors shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </>
        ) : (
          <button
            onClick={() => $leftPanelOpen.set(true)}
            title="Expand diagrams panel"
            className="w-full h-full flex items-center justify-center text-[#2a3550] hover:text-[#8b9ab0] hover:bg-[#161c2a] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Content — only visible when open */}
      {open && (
        <>
          {!project ? (
            <p className="text-xs text-[#2a3a52] p-3 whitespace-nowrap">No project open</p>
          ) : (
            <div className="flex flex-col gap-0.5 p-1.5 overflow-y-auto flex-1 min-w-0">
              <TreeItem node={buildTree(project)} activeDiagramId={activeDiagramId} indent={0} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
