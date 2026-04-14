'use client';

import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { enterSubdiagram } from '../../stores/diagramStore';

export interface C4FlowNodeData extends Record<string, unknown> {
  nodeType: string;
  label: string;
  description?: string;
  technology?: string;
  childDiagramId?: string;
  color: string;
  isSelected?: boolean;
}

const visibleHandleStyle = {
  width: 10,
  height: 10,
  borderRadius: '999px',
  border: '2px solid var(--c4-handle-border)',
  background: 'var(--c4-handle-bg)',
};

const hiddenHandleStyle = {
  width: 14,
  height: 14,
  border: 'none',
  background: 'transparent',
  opacity: 0,
};

// ---------------------------------------------------------------------------
// Per-type SVG icon (mirrors ShapePalette icons)
// ---------------------------------------------------------------------------
function NodeTypeIcon({ nodeType }: { nodeType: string }) {
  const svgProps = {
    viewBox: '0 0 24 24' as const,
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.8,
    width: 18,
    height: 18,
    style: { display: 'block' },
  };
  switch (nodeType) {
    case 'Person':
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="7" r="4" />
          <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
        </svg>
      );
    case 'System':
      return (
        <svg {...svgProps}>
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <path d="M7 8h10M7 12h6" />
        </svg>
      );
    case 'SystemExt':
      return (
        <svg {...svgProps} strokeDasharray="3 2">
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <path strokeDasharray="none" d="M7 8h10M7 12h6" />
        </svg>
      );
    case 'Container':
      return (
        <svg {...svgProps}>
          <rect x="3" y="6" width="18" height="12" rx="1" />
          <path d="M3 10h18" />
          <circle cx="7" cy="8" r="0.8" fill="currentColor" />
          <circle cx="10" cy="8" r="0.8" fill="currentColor" />
        </svg>
      );
    case 'ContainerDb':
      return (
        <svg {...svgProps}>
          <ellipse cx="12" cy="7" rx="8" ry="3" />
          <path d="M4 7v10c0 1.657 3.582 3 8 3s8-1.343 8-3V7" />
          <path d="M4 12c0 1.657 3.582 3 8 3s8-1.343 8-3" />
        </svg>
      );
    case 'Component':
      return (
        <svg {...svgProps}>
          <rect x="5" y="5" width="14" height="14" rx="1" />
          <rect x="8" y="8" width="3" height="3" rx="0.5" />
          <rect x="8" y="13" width="3" height="3" rx="0.5" />
          <path d="M13 9.5h3M13 14.5h3" />
        </svg>
      );
    case 'Boundary':
      return (
        <svg {...svgProps} strokeDasharray="4 2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Shape-specific background / border decorations
// ---------------------------------------------------------------------------
function ShapeBackground({ nodeType, color, isSelected }: { nodeType: string; color: string; isSelected?: boolean }) {
  const selColor = '#facc15';
  const borderColor = isSelected ? selColor : 'rgba(255,255,255,0.18)';
  const bw = isSelected ? 2.5 : 1.5;

  // --- Boundary: dashed transparent box ---
  if (nodeType === 'Boundary') {
    return (
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(120,53,15,0.18)',
          borderRadius: 8,
          border: `${bw}px dashed ${isSelected ? selColor : 'rgba(200,140,60,0.65)'}`,
          boxSizing: 'border-box',
        }}
      />
    );
  }

  // --- SystemExt: dashed border ---
  if (nodeType === 'SystemExt') {
    return (
      <div
        style={{
          position: 'absolute', inset: 0,
          background: color,
          borderRadius: 8,
          border: `${bw}px dashed ${borderColor}`,
          boxSizing: 'border-box',
        }}
      />
    );
  }

  // --- ContainerDb: SVG cylinder ---
  if (nodeType === 'ContainerDb') {
    return (
      <svg
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {/* Body rectangle */}
        <rect x="0" y="18" width="100" height="64" fill={color} />
        {/* Left and right body edges */}
        <line x1="0" y1="18" x2="0" y2="82" stroke={borderColor} strokeWidth={bw} />
        <line x1="100" y1="18" x2="100" y2="82" stroke={borderColor} strokeWidth={bw} />
        {/* Bottom ellipse */}
        <ellipse cx="50" cy="82" rx="50" ry="14" fill={color} stroke={borderColor} strokeWidth={bw} />
        {/* Top ellipse (drawn last so it's on top) */}
        <ellipse cx="50" cy="18" rx="50" ry="14" fill={color} stroke={borderColor} strokeWidth={bw} />
        {/* Top shadow overlay to create cylinder depth illusion */}
        <ellipse cx="50" cy="18" rx="50" ry="14" fill="rgba(0,0,0,0.18)" stroke="none" />
      </svg>
    );
  }

  // --- Container: solid box with top header bar ---
  if (nodeType === 'Container') {
    return (
      <div
        style={{
          position: 'absolute', inset: 0,
          background: color,
          borderRadius: 8,
          border: `${bw}px solid ${borderColor}`,
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 11,
            background: 'rgba(0,0,0,0.28)',
            display: 'flex', alignItems: 'center', paddingLeft: 6, gap: 3,
          }}
        >
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.55)' }} />
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.40)' }} />
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.25)' }} />
        </div>
      </div>
    );
  }

  // --- Component: box with two UML port tabs on the right ---
  // Port tab vertical positions (% from top) matching the UML component notation
  const UML_PORT_TOP_POSITIONS = [28, 52];
  if (nodeType === 'Component') {
    return (
      <div
        style={{
          position: 'absolute', inset: 0,
          background: color,
          borderRadius: 8,
          border: `${bw}px solid ${borderColor}`,
          boxSizing: 'border-box',
          overflow: 'visible',
        }}
      >
        {/* UML component port tabs */}
        {UML_PORT_TOP_POSITIONS.map((topPct) => (
          <div
            key={topPct}
            style={{
              position: 'absolute',
              right: -7,
              top: `${topPct}%`,
              width: 9,
              height: 7,
              background: color,
              border: `${bw}px solid ${borderColor}`,
              borderRadius: 1,
              boxSizing: 'border-box',
            }}
          />
        ))}
      </div>
    );
  }

  // --- Person: rounded top (arc-like) box ---
  if (nodeType === 'Person') {
    return (
      <div
        style={{
          position: 'absolute', inset: 0,
          background: color,
          borderRadius: '40% 40% 8px 8px',
          border: `${bw}px solid ${borderColor}`,
          boxSizing: 'border-box',
        }}
      />
    );
  }

  // --- Default (System): plain solid box ---
  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        background: color,
        borderRadius: 8,
        border: `${bw}px solid ${borderColor}`,
        boxSizing: 'border-box',
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main node component
// ---------------------------------------------------------------------------

/** Custom ReactFlow node that shows a drill-down icon when the node has a sub-diagram. */
export default function C4FlowNode({ id, data }: NodeProps) {
  const d = data as C4FlowNodeData;

  // Extra top padding for Container (header bar) and Person (arc top)
  const paddingTop = d.nodeType === 'Container' ? 17 : d.nodeType === 'Person' ? 8 : 6;

  return (
    <>
      <NodeResizer
        minWidth={100}
        minHeight={60}
        isVisible={!!d.isSelected}
        lineClassName="!border-indigo-400/70"
        handleClassName="!bg-indigo-400 !border-indigo-200 !rounded-sm"
      />
      <Handle className="c4-node-handle-visible" type="source" id="source-top" position={Position.Top} style={{ ...visibleHandleStyle, top: 0, transform: 'translate(-50%, -50%)' }} />
      <Handle type="target" id="target-top" position={Position.Top} style={{ ...hiddenHandleStyle, top: 0, transform: 'translate(-50%, -50%)' }} />

      <Handle className="c4-node-handle-visible" type="source" id="source-right" position={Position.Right} style={{ ...visibleHandleStyle, right: 0, transform: 'translate(50%, -50%)' }} />
      <Handle type="target" id="target-right" position={Position.Right} style={{ ...hiddenHandleStyle, right: 0, transform: 'translate(50%, -50%)' }} />

      <Handle className="c4-node-handle-visible" type="source" id="source-bottom" position={Position.Bottom} style={{ ...visibleHandleStyle, bottom: 0, transform: 'translate(-50%, 50%)' }} />
      <Handle type="target" id="target-bottom" position={Position.Bottom} style={{ ...hiddenHandleStyle, bottom: 0, transform: 'translate(-50%, 50%)' }} />

      <Handle className="c4-node-handle-visible" type="source" id="source-left" position={Position.Left} style={{ ...visibleHandleStyle, left: 0, transform: 'translate(-50%, -50%)' }} />
      <Handle type="target" id="target-left" position={Position.Left} style={{ ...hiddenHandleStyle, left: 0, transform: 'translate(-50%, -50%)' }} />

      {/* Shape-specific visual background */}
      <ShapeBackground nodeType={d.nodeType} color={d.color} isSelected={d.isSelected} />

      {/* Text content — layered above the shape */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          padding: `${paddingTop}px 12px 6px`,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
          color: '#fff',
        }}
      >
        {/* Type icon */}
        <div style={{ opacity: 0.85, marginBottom: 2 }}>
          <NodeTypeIcon nodeType={d.nodeType} />
        </div>

        <div style={{ fontSize: '9px', opacity: 0.65, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.2 }}>
          {d.nodeType}
        </div>
        <div style={{ fontWeight: 700, fontSize: '13px', lineHeight: 1.3, marginTop: 1 }}>{d.label}</div>
        {d.description && (
          <div style={{ fontSize: '10px', opacity: 0.75, marginTop: 2 }}>{d.description}</div>
        )}
        {d.technology && (
          <div style={{ fontSize: '9px', opacity: 0.6, fontStyle: 'italic', marginTop: 1 }}>
            [{d.technology}]
          </div>
        )}

        {d.childDiagramId && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              enterSubdiagram(id);
            }}
            title="Enter sub-diagram"
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.35)',
              borderRadius: 4,
              padding: '2px 3px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              color: '#fff',
            }}
          >
            {/* Magnifying glass icon */}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        )}
      </div>
    </>
  );
}
