'use client';

import { NodeResizer, type NodeProps } from '@xyflow/react';

export interface AnnotationNodeData extends Record<string, unknown> {
  text: string;
  fontSize?: number;
  color?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  isSelected?: boolean;
}

export default function AnnotationNode({ data }: NodeProps) {
  const d = data as AnnotationNodeData;

  return (
    <>
      <NodeResizer
        minWidth={60}
        minHeight={24}
        isVisible={!!d.isSelected}
        lineClassName="!border-yellow-400/70"
        handleClassName="!bg-yellow-400 !border-yellow-200 !rounded-sm"
      />
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px 8px',
          boxSizing: 'border-box',
          outline: d.isSelected ? '1.5px dashed rgba(250,204,21,0.6)' : 'none',
          borderRadius: 4,
          background: 'transparent',
          cursor: 'move',
        }}
      >
        <span
          style={{
            fontSize: d.fontSize ?? 13,
            color: d.color ?? '#94a3b8',
            fontWeight: d.fontWeight ?? 'normal',
            fontStyle: d.fontStyle ?? 'normal',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            textAlign: 'center',
            lineHeight: 1.4,
            userSelect: 'none',
          }}
        >
          {d.text}
        </span>
      </div>
    </>
  );
}
