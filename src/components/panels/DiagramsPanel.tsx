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
// Toggle button (sits on the right edge of the panel)
// ---------------------------------------------------------------------------

function ToggleButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={open ? 'Hide diagrams panel' : 'Show diagrams panel'}
      className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full w-4 h-8 flex items-center justify-center bg-[#0c0f1a] border border-l-0 border-[#1a2035] text-[#2a3550] hover:text-[#8b9ab0] hover:bg-[#161c2a] transition-colors z-20"
      style={{ borderRadius: '0 4px 4px 0' }}
    >
      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d={open ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
      </svg>
    </button>
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
    <div className="relative flex shrink-0">
      <aside
        className={`bg-[#0c0f1a] border-r border-[#1a2035] flex flex-col overflow-hidden transition-[width] duration-200 ease-out ${
          open ? 'w-48' : 'w-0'
        }`}
      >
        <div className="px-3 py-2 text-[11px] font-semibold text-[#3a4a62] uppercase tracking-wider border-b border-[#1a2035] shrink-0 whitespace-nowrap">
          Diagrams
        </div>

        {!project ? (
          <p className="text-xs text-[#2a3a52] p-3 whitespace-nowrap">No project open</p>
        ) : (
          <div className="flex flex-col gap-0.5 p-1.5 overflow-y-auto flex-1 min-w-0">
            <TreeItem node={buildTree(project)} activeDiagramId={activeDiagramId} indent={0} />
          </div>
        )}
      </aside>

      <ToggleButton open={open} onToggle={() => $leftPanelOpen.set(!open)} />
    </div>
  );
}
