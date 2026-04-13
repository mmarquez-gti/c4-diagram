'use client';

import { NodeResizer, type NodeProps } from '@xyflow/react';

export interface GroupBoxNodeData extends Record<string, unknown> {
  label?: string;
  borderColor?: string;
  fillColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  fontSize?: number;
  isSelected?: boolean;
}

export default function GroupBoxNode({ data }: NodeProps) {
  const d = data as GroupBoxNodeData;

  const borderColor = d.borderColor ?? '#6366f1';
  const fillColor = d.fillColor ?? 'rgba(99,102,241,0.08)';
  const borderStyle = d.borderStyle ?? 'dashed';
  const selBorderColor = d.isSelected ? '#facc15' : borderColor;
  const borderWidth = d.isSelected ? 2 : 1.5;

  return (
    <>
      <NodeResizer
        minWidth={80}
        minHeight={60}
        isVisible={!!d.isSelected}
        lineClassName="!border-yellow-400/70"
        handleClassName="!bg-yellow-400 !border-yellow-200 !rounded-sm"
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: fillColor,
          border: `${borderWidth}px ${borderStyle} ${selBorderColor}`,
          borderRadius: 8,
          boxSizing: 'border-box',
          pointerEvents: 'none',
        }}
      />
      {d.label && (
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 10,
            fontSize: d.fontSize ?? 12,
            color: selBorderColor,
            fontWeight: 600,
            letterSpacing: '0.03em',
            pointerEvents: 'none',
            userSelect: 'none',
            maxWidth: 'calc(100% - 20px)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {d.label}
        </div>
      )}
    </>
  );
}
