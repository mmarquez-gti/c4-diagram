'use client';

import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { $project, addNode, createProject } from '../../stores/diagramStore';
import type { C4NodeType } from '../../lib/c4/types';

// ---------------------------------------------------------------------------
// Shape definitions with icons
// ---------------------------------------------------------------------------

interface ShapeDef {
  type: C4NodeType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const SHAPES: ShapeDef[] = [
  {
    type: 'Person',
    label: 'Person',
    description: 'A human user',
    color: '#3730a3',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
        <circle cx="12" cy="7" r="4" />
        <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
      </svg>
    ),
  },
  {
    type: 'System',
    label: 'System',
    description: 'Internal system',
    color: '#065f46',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <path d="M7 8h10M7 12h6" />
      </svg>
    ),
  },
  {
    type: 'SystemExt',
    label: 'Ext. System',
    description: 'External system',
    color: '#374151',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" className="w-full h-full">
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <path strokeDasharray="none" d="M7 8h10M7 12h6" />
      </svg>
    ),
  },
  {
    type: 'Container',
    label: 'Container',
    description: 'Application / service',
    color: '#065f46',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
        <rect x="3" y="6" width="18" height="12" rx="1" />
        <path d="M3 10h18" />
        <circle cx="7" cy="8" r="0.8" fill="currentColor" />
        <circle cx="10" cy="8" r="0.8" fill="currentColor" />
      </svg>
    ),
  },
  {
    type: 'ContainerDb',
    label: 'Database',
    description: 'Database / storage',
    color: '#4c1d95',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
        <ellipse cx="12" cy="7" rx="8" ry="3" />
        <path d="M4 7v10c0 1.657 3.582 3 8 3s8-1.343 8-3V7" />
        <path d="M4 12c0 1.657 3.582 3 8 3s8-1.343 8-3" />
      </svg>
    ),
  },
  {
    type: 'Component',
    label: 'Component',
    description: 'Encapsulated component',
    color: '#1e3a5f',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
        <rect x="5" y="5" width="14" height="14" rx="1" />
        <rect x="8" y="8" width="3" height="3" rx="0.5" />
        <rect x="8" y="13" width="3" height="3" rx="0.5" />
        <path d="M13 9.5h3M13 14.5h3" />
      </svg>
    ),
  },
  {
    type: 'Boundary',
    label: 'Boundary',
    description: 'Logical boundary',
    color: '#78350f',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" className="w-full h-full">
        <rect x="3" y="3" width="18" height="18" rx="2" />
      </svg>
    ),
  },
];

// ---------------------------------------------------------------------------
// Initial placement constants for newly added nodes
// ---------------------------------------------------------------------------

const NODE_PLACE_MIN_X = 120;
const NODE_PLACE_MAX_X_OFFSET = 300;
const NODE_PLACE_MIN_Y = 80;
const NODE_PLACE_MAX_Y_OFFSET = 200;

// ---------------------------------------------------------------------------
// ShapePalette component
// ---------------------------------------------------------------------------

export default function ShapePalette() {
  const project = useStore($project);
  const [expanded, setExpanded] = useState(false);

  const handleAdd = (type: C4NodeType) => {
    if (!project) {
      createProject();
    }
    addNode({ type, label: type, x: NODE_PLACE_MIN_X + Math.random() * NODE_PLACE_MAX_X_OFFSET, y: NODE_PLACE_MIN_Y + Math.random() * NODE_PLACE_MAX_Y_OFFSET });
  };

  return (
    <div
      className={`relative flex flex-col shrink-0 bg-[#0c0f1a] border-r border-[#1a2035] overflow-hidden transition-[width] duration-200 ease-out z-10 ${
        expanded ? 'w-44' : 'w-11'
      }`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Header */}
      <div
        className={`flex items-center border-b border-[#1a2035] h-9 shrink-0 overflow-hidden transition-all duration-200 ${
          expanded ? 'px-3 gap-2' : 'justify-center px-0'
        }`}
      >
        <svg
          className="w-4 h-4 text-indigo-400 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        {expanded && (
          <span className="text-[11px] font-semibold text-[#4a5a72] uppercase tracking-wider whitespace-nowrap">
            Add Shape
          </span>
        )}
      </div>

      {/* Shape items */}
      <div className="flex flex-col py-1.5 gap-0.5 overflow-hidden">
        {SHAPES.map(({ type, label, description, color, icon }) => (
          <button
            key={type}
            onClick={() => handleAdd(type)}
            title={expanded ? description : label}
            className={`flex items-center gap-2.5 rounded mx-1 transition-colors group hover:bg-[#161c2a] ${
              expanded ? 'px-2 py-1.5' : 'justify-center p-2'
            }`}
          >
            {/* Color dot / icon */}
            <span
              className="shrink-0 w-5 h-5 rounded flex items-center justify-center"
              style={{ color, opacity: 0.9 }}
            >
              {icon}
            </span>

            {expanded && (
              <div className="flex flex-col items-start text-left overflow-hidden">
                <span className="text-[12px] text-[#b0bdd0] group-hover:text-white transition-colors leading-none whitespace-nowrap">
                  {label}
                </span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Expand hint when collapsed */}
      {!expanded && (
        <div className="flex-1 flex items-end justify-center pb-3">
          <svg className="w-3 h-3 text-[#2a3550]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </div>
  );
}
