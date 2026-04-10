'use client';

import { useRef, useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import {
  $project,
  $activeDiagramId,
  $navigationStack,
  createProject,
  loadProject,
  goBack,
  navigateTo,
  undo,
  redo,
} from '../../stores/diagramStore';
import { $history } from '../../stores/historyStore';
import { $leftPanelOpen, $rightPanelOpen } from '../../stores/uiStore';
import { serializeProject } from '../../lib/mermaid/serializer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function downloadFile(name: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Platform-aware shortcut helper
// ---------------------------------------------------------------------------

function isMac(): boolean {
  return typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
}

function shortcut(key: string): string {
  return `${isMac() ? '⌘' : 'Ctrl+'}${key}`;
}

interface MenuItem {
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  separator?: never;
}
interface SeparatorItem {
  separator: true;
  label?: never;
  onClick?: never;
}
type MenuEntry = MenuItem | SeparatorItem;

interface MenuProps {
  label: string;
  items: MenuEntry[];
}

function Menu({ label, items }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        className={`px-3 h-full text-[13px] transition-colors rounded-sm ${
          open
            ? 'bg-[#1e2539] text-white'
            : 'text-[#8b9ab0] hover:text-white hover:bg-[#161c2a]'
        }`}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-0.5 min-w-[200px] bg-[#0f1520] border border-[#1e2539] rounded shadow-xl z-50 py-1"
          onClick={() => setOpen(false)}
        >
          {items.map((item, i) => {
            if ('separator' in item && item.separator) {
              return <div key={i} className="border-t border-[#1e2539] my-1" />;
            }
            const mi = item as MenuItem;
            return (
              <button
                key={i}
                disabled={mi.disabled}
                onClick={mi.onClick}
                className="w-full flex items-center justify-between px-3 py-[5px] text-[13px] text-left text-[#cbd5e1] hover:bg-[#1e2a42] hover:text-white disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
              >
                <span>{mi.label}</span>
                {mi.shortcut && (
                  <span className="text-[11px] text-[#4a5568] ml-6 shrink-0">{mi.shortcut}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditorHeader
// ---------------------------------------------------------------------------

export default function EditorHeader() {
  const project = useStore($project);
  const activeDiagramId = useStore($activeDiagramId);
  const navigationStack = useStore($navigationStack);
  const history = useStore($history);
  const leftOpen = useStore($leftPanelOpen);
  const rightOpen = useStore($rightPanelOpen);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const canGoBack = navigationStack.length > 1;

  const handleNewProject = () => {
    const name = prompt('Project name:', 'My C4 Project');
    if (name !== null) createProject(name || 'My C4 Project');
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

  const handleExportMermaid = () => {
    if (!project) return;
    const mmd = serializeProject(project.diagrams, project.rootDiagramId);
    downloadFile(`${project.name}.mmd`, mmd, 'text/plain');
  };

  const handleExportJson = () => {
    if (!project) return;
    downloadFile(`${project.name}.c4m`, JSON.stringify(project, null, 2), 'application/json');
  };

  const fileMenu: MenuEntry[] = [
    { label: 'New project…', shortcut: shortcut('N'), onClick: handleNewProject },
    { label: 'Import .c4m…', onClick: handleImport },
    { separator: true },
    { label: 'Export as Mermaid', onClick: handleExportMermaid, disabled: !project },
    { label: 'Export as .c4m', onClick: handleExportJson, disabled: !project },
  ];

  const editMenu: MenuEntry[] = [
    { label: 'Undo', shortcut: shortcut('Z'), onClick: undo, disabled: !canUndo },
    { label: 'Redo', shortcut: shortcut('Y'), onClick: redo, disabled: !canRedo },
  ];

  const viewMenu: MenuEntry[] = [
    {
      label: leftOpen ? 'Hide diagrams panel' : 'Show diagrams panel',
      onClick: () => $leftPanelOpen.set(!leftOpen),
    },
    {
      label: rightOpen ? 'Hide properties panel' : 'Show properties panel',
      onClick: () => $rightPanelOpen.set(!rightOpen),
    },
  ];

  return (
    <header className="flex items-center h-10 bg-[#0c0f1a] border-b border-[#1a2035] shrink-0 px-2 gap-1 select-none">
      {/* Brand mark */}
      <div className="flex items-center gap-2 pr-3 mr-1 border-r border-[#1a2035]">
        <svg className="w-5 h-5 text-indigo-400 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="5" width="6" height="5" rx="1" />
          <rect x="12" y="5" width="6" height="5" rx="1" />
          <rect x="7" y="13" width="6" height="4" rx="1" />
          <path d="M5 10v3h5M15 10v3h-5" />
        </svg>
        <span className="text-[13px] font-semibold text-[#8b9ab0] tracking-wide leading-none">
          C4 Diagram
        </span>
      </div>

      {/* Menus */}
      <nav className="flex items-stretch h-full">
        <Menu label="File" items={fileMenu} />
        <Menu label="Edit" items={editMenu} />
        <Menu label="View" items={viewMenu} />
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Breadcrumb navigation */}
      {project && navigationStack.length > 0 && (
        <nav className="flex items-center gap-1 text-[12px] px-2">
          {navigationStack.map((diagId, i) => {
            const d = project.diagrams[diagId];
            const isLast = i === navigationStack.length - 1;
            return (
              <span key={diagId} className="flex items-center gap-1">
                {i > 0 && (
                  <svg className="w-3 h-3 text-[#3a4560]" fill="none" viewBox="0 0 6 10" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M1 1l4 4-4 4" />
                  </svg>
                )}
                <button
                  onClick={() => navigateTo(i)}
                  className={`px-1.5 py-0.5 rounded transition-colors ${
                    isLast
                      ? 'text-indigo-300 font-medium cursor-default'
                      : 'text-[#4a5a72] hover:text-[#8b9ab0] hover:bg-[#161c2a]'
                  }`}
                >
                  {d?.title ?? diagId}
                </button>
              </span>
            );
          })}
        </nav>
      )}

      {/* Back button */}
      {canGoBack && (
        <button
          onClick={goBack}
          className="flex items-center gap-1 px-2 py-1 text-[12px] text-[#64748b] hover:text-white hover:bg-[#161c2a] rounded transition-colors"
          title="Go back"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      )}

      {/* Project name pill */}
      {project && (
        <div className="ml-2 px-2.5 py-0.5 rounded-full bg-[#131a2c] border border-[#1e2a42] text-[11px] text-[#4a5a72] font-medium max-w-[140px] truncate" title={project.name}>
          {project.name}
        </div>
      )}
    </header>
  );
}
