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
import { $leftPanelOpen, $rightPanelOpen, $darkMode } from '../../stores/uiStore';
import { serializeProject } from '../../lib/mermaid/serializer';
import { exportCurrentLayerToPng, exportProjectToPdf } from '../../lib/exportUtils';
import { buildShareUrl } from '../../lib/urlState';

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
        className="px-3 h-full text-[13px] transition-colors rounded-sm"
        style={{
          backgroundColor: open ? 'var(--c4-menu-active-bg)' : 'transparent',
          color: open ? 'var(--c4-text-primary)' : 'var(--c4-text-secondary)',
        }}
        onMouseEnter={(e) => {
          if (!open) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--c4-panel-hover)';
        }}
        onMouseLeave={(e) => {
          if (!open) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
        }}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-0.5 min-w-[200px] rounded shadow-xl z-50 py-1"
          style={{
            backgroundColor: 'var(--c4-menu-bg)',
            border: '1px solid var(--c4-menu-border)',
          }}
          onClick={() => setOpen(false)}
        >
          {items.map((item, i) => {
            if ('separator' in item && item.separator) {
              return (
                <div
                  key={i}
                  className="my-1"
                  style={{ borderTop: '1px solid var(--c4-menu-border)' }}
                />
              );
            }
            const mi = item as MenuItem;
            return (
              <button
                key={i}
                disabled={mi.disabled}
                onClick={mi.onClick}
                className="w-full flex items-center justify-between px-3 py-[5px] text-[13px] text-left transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
                style={{ color: 'var(--c4-menu-text)' }}
                onMouseEnter={(e) => {
                  if (!mi.disabled) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--c4-menu-hover)';
                  if (!mi.disabled) (e.currentTarget as HTMLElement).style.color = 'var(--c4-text-primary)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'var(--c4-menu-text)';
                }}
              >
                <span>{mi.label}</span>
                {mi.shortcut && (
                  <span
                    className="text-[11px] ml-6 shrink-0"
                    style={{ color: 'var(--c4-menu-shortcut)' }}
                  >
                    {mi.shortcut}
                  </span>
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
  const darkMode = useStore($darkMode);

  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number; title: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const canGoBack = navigationStack.length > 1;

  // Sync dark/light class on <html> whenever darkMode changes
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
    }
  }, [darkMode]);

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

  const handleExportPng = async () => {
    if (!project || !activeDiagramId) return;
    const diagram = project.diagrams[activeDiagramId];
    const name = diagram?.title ?? project.name;
    try {
      await exportCurrentLayerToPng(name);
    } catch {
      alert('Failed to export PNG. Please try again.');
    }
  };

  const handleExportPdf = async () => {
    if (!project || exportingPdf) return;
    setExportingPdf(true);
    setExportProgress(null);
    try {
      await exportProjectToPdf(project, project.name, (current, total, title) => {
        setExportProgress({ current, total, title });
      });
    } catch {
      alert('Failed to export PDF. Please try again.');
    } finally {
      setExportingPdf(false);
      setExportProgress(null);
    }
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

  const handleShare = async () => {
    if (!project || !activeDiagramId) return;
    const url = buildShareUrl({ project, activeDiagramId });
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('Copy this link to share:', url);
    }
  };

  const fileMenu: MenuEntry[] = [
    { label: 'New project…', shortcut: shortcut('N'), onClick: handleNewProject },
    { label: 'Import .c4m…', onClick: handleImport },
    { separator: true },
    { label: 'Export current layer as PNG', onClick: handleExportPng, disabled: !project || !activeDiagramId },
    { label: exportingPdf ? 'Exporting PDF…' : 'Export all as interactive PDF', onClick: handleExportPdf, disabled: !project || exportingPdf },
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
    { separator: true },
    {
      label: darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      onClick: () => $darkMode.set(!darkMode),
    },
  ];

  return (
    <>
      {/* Full-screen loading overlay shown during PDF export */}
      {exportingPdf && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#030712]/90 backdrop-blur-sm select-none">
          {/* Spinner */}
          <svg
            className="w-14 h-14 mb-5 text-indigo-400 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>

          <p className="text-[15px] font-semibold text-white mb-1">Generating PDF…</p>

          {exportProgress ? (
            <>
              <p className="text-[13px] text-[#8b9ab0] mb-3">
                {exportProgress.current} / {exportProgress.total} &mdash; {exportProgress.title}
              </p>
              {/* Progress bar */}
              <div className="w-56 h-1.5 rounded-full bg-[#1e2a42] overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-[13px] text-[#8b9ab0]">Preparing diagrams…</p>
          )}

          <p className="text-[11px] text-[#4a5a72] mt-5">Please do not close or navigate away</p>
        </div>
      )}

      <header
        className="flex items-center h-10 shrink-0 px-2 gap-1 select-none"
        style={{
          backgroundColor: 'var(--c4-panel-bg)',
          borderBottom: '1px solid var(--c4-border)',
        }}
      >
        {/* Brand mark */}
        <div
          className="flex items-center gap-2 pr-3 mr-1"
          style={{ borderRight: '1px solid var(--c4-border)' }}
        >
          <svg className="w-5 h-5 text-indigo-400 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="5" width="6" height="5" rx="1" />
            <rect x="12" y="5" width="6" height="5" rx="1" />
            <rect x="7" y="13" width="6" height="4" rx="1" />
            <path d="M5 10v3h5M15 10v3h-5" />
          </svg>
          <span
            className="text-[13px] font-semibold tracking-wide leading-none"
            style={{ color: 'var(--c4-text-secondary)' }}
          >
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
                    <svg
                      className="w-3 h-3"
                      style={{ color: 'var(--c4-text-faint)' }}
                      fill="none"
                      viewBox="0 0 6 10"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M1 1l4 4-4 4" />
                    </svg>
                  )}
                  <button
                    onClick={() => navigateTo(i)}
                    className="px-1.5 py-0.5 rounded transition-colors"
                    style={{
                      color: isLast ? undefined : 'var(--c4-text-muted)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isLast) {
                        (e.currentTarget as HTMLElement).style.color = 'var(--c4-text-secondary)';
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--c4-panel-hover)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isLast) {
                        (e.currentTarget as HTMLElement).style.color = 'var(--c4-text-muted)';
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {isLast ? (
                      <span className="text-indigo-300 font-medium cursor-default">{d?.title ?? diagId}</span>
                    ) : (
                      d?.title ?? diagId
                    )}
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
            className="flex items-center gap-1 px-2 py-1 text-[12px] rounded transition-colors"
            style={{ color: 'var(--c4-text-muted)' }}
            title="Go back"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--c4-text-primary)';
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--c4-panel-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--c4-text-muted)';
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}

        {/* Share button */}
        {project && activeDiagramId && (
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] rounded transition-colors ml-1"
            style={{
              color: copied ? 'var(--c4-text-primary)' : 'var(--c4-text-secondary)',
              backgroundColor: copied ? 'var(--c4-secondary-bg)' : 'transparent',
            }}
            title="Copy share link"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--c4-panel-hover)';
              (e.currentTarget as HTMLElement).style.color = 'var(--c4-text-primary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = copied ? 'var(--c4-secondary-bg)' : 'transparent';
              (e.currentTarget as HTMLElement).style.color = copied ? 'var(--c4-text-primary)' : 'var(--c4-text-secondary)';
            }}
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </>
            )}
          </button>
        )}

        {/* Theme toggle */}
        <button
          onClick={() => $darkMode.set(!darkMode)}
          className="flex items-center justify-center w-7 h-7 rounded transition-colors ml-1"
          style={{ color: 'var(--c4-text-secondary)' }}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--c4-panel-hover)';
            (e.currentTarget as HTMLElement).style.color = 'var(--c4-text-primary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--c4-text-secondary)';
          }}
        >
          {darkMode ? (
            /* Sun icon for switching to light */
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
              <circle cx="12" cy="12" r="4" />
              <path strokeLinecap="round" d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          ) : (
            /* Moon icon for switching to dark */
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          )}
        </button>

        {/* Project name pill */}
        {project && (
          <div
            className="ml-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium max-w-[140px] truncate"
            style={{
              backgroundColor: 'var(--c4-secondary-bg)',
              border: '1px solid var(--c4-border-strong)',
              color: 'var(--c4-text-muted)',
            }}
            title={project.name}
          >
            {project.name}
          </div>
        )}
      </header>
    </>
  );
}
