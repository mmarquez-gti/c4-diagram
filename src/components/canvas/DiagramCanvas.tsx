'use client';

import { useStore } from '@nanostores/react';
import { $project, $activeDiagramId, getActiveDiagram } from '../../stores/diagramStore';

/**
 * DiagramCanvas — React island placeholder.
 *
 * Phase 1: Renders a canvas shell connected to Nano Stores state.
 * Phase 2: Will integrate React Flow with custom C4 node types and drag & drop.
 */
export default function DiagramCanvas() {
  const project = useStore($project);
  const activeDiagramId = useStore($activeDiagramId);

  const diagram = getActiveDiagram();

  return (
    <div className="relative w-full h-full bg-gray-950 flex flex-col items-center justify-center select-none">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'radial-gradient(circle, #6b7280 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Canvas content */}
      <div className="relative z-10 flex flex-col items-center gap-4 text-center p-8">
        {project ? (
          <>
            <p className="text-sm text-gray-400">
              Project: <span className="text-white font-medium">{project.name}</span>
            </p>
            {diagram ? (
              <p className="text-sm text-gray-400">
                Active diagram: <span className="text-blue-400">{diagram.title}</span>
              </p>
            ) : (
              <p className="text-sm text-gray-500 italic">No diagram selected</p>
            )}
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mb-2">
              <svg
                className="w-8 h-8 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2h-2a2 2 0 01-2-2"
                />
              </svg>
            </div>
            <p className="text-gray-300 font-medium">No project open</p>
            <p className="text-gray-500 text-sm max-w-xs">
              Create a new project or import an existing{' '}
              <code className="text-blue-400">.c4m</code> file to get started.
            </p>
          </>
        )}

        <div className="mt-4 px-3 py-1.5 rounded-full bg-gray-800 text-xs text-gray-400">
          Interactive canvas — Phase 2 (React Flow drag &amp; drop)
        </div>
      </div>
    </div>
  );
}
