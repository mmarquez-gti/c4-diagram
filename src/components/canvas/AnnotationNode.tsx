'use client';

import { NodeResizer, type NodeProps } from '@xyflow/react';

export interface AnnotationNodeData extends Record<string, unknown> {
  nodeType: 'TextLabel' | 'GroupBox';
  label: string;
  description?: string;
  color?: string;
  isSelected?: boolean;
}

// ---------------------------------------------------------------------------
// TextLabel node — free-floating text annotation
// ---------------------------------------------------------------------------

export function TextLabelNode({ data }: NodeProps) {
  const d = data as AnnotationNodeData;
  const textColor = d.color ?? '#e2e8f0';
  const selColor = '#facc15';

  return (
    <>
      <NodeResizer
        minWidth={80}
        minHeight={30}
        isVisible={!!d.isSelected}
        lineClassName="!border-yellow-400/70"
        handleClassName="!bg-yellow-400 !border-yellow-200 !rounded-sm"
      />
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          padding: '6px 10px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          outline: d.isSelected ? `2px solid ${selColor}` : '2px solid transparent',
          outlineOffset: 2,
          borderRadius: 4,
          userSelect: 'none',
        }}
      >
        <div
          style={{
            color: d.label ? textColor : `${textColor}55`,
            fontWeight: 600,
            fontSize: '14px',
            lineHeight: 1.35,
            wordBreak: 'break-word',
            fontStyle: d.label ? 'normal' : 'italic',
          }}
        >
          {d.label || 'Text…'}
        </div>
        {d.description && (
          <div
            style={{
              color: textColor,
              opacity: 0.7,
              fontSize: '11px',
              marginTop: 3,
              lineHeight: 1.3,
              wordBreak: 'break-word',
            }}
          >
            {d.description}
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// GroupBox node — visual grouping rectangle placed behind other nodes
// ---------------------------------------------------------------------------

export function GroupBoxNode({ data }: NodeProps) {
  const d = data as AnnotationNodeData;
  const accentHex = d.color ?? '#6366f1';
  const selColor = '#facc15';
  const borderColor = d.isSelected ? selColor : accentHex;

  return (
    <>
      <NodeResizer
        minWidth={120}
        minHeight={80}
        isVisible={!!d.isSelected}
        lineClassName="!border-yellow-400/70"
        handleClassName="!bg-yellow-400 !border-yellow-200 !rounded-sm"
      />
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          border: `2px dashed ${borderColor}`,
          borderRadius: 8,
          background: `${accentHex}1a`,
          display: 'flex',
          flexDirection: 'column',
          userSelect: 'none',
          overflow: 'hidden',
        }}
      >
        {/* Title bar */}
        <div
          style={{
            padding: '3px 10px',
            background: `${accentHex}33`,
            borderBottom: `1px dashed ${borderColor}`,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            minHeight: 26,
            flexShrink: 0,
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke={accentHex}
            strokeWidth="2"
            style={{ opacity: 0.8, flexShrink: 0 }}
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18" />
          </svg>
          <span
            style={{
              color: '#e2e8f0',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              opacity: 0.9,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {d.label}
          </span>
        </div>

        {/* Description */}
        {d.description && (
          <div
            style={{
              padding: '4px 10px',
              color: '#94a3b8',
              fontSize: '10px',
              lineHeight: 1.3,
            }}
          >
            {d.description}
          </div>
        )}
      </div>
    </>
  );
}
