'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { enterSubdiagram } from '../../stores/diagramStore';

export interface C4FlowNodeData extends Record<string, unknown> {
  nodeType: string;
  label: string;
  description?: string;
  technology?: string;
  childDiagramId?: string;
  color: string;
}

/** Custom ReactFlow node that shows a drill-down icon when the node has a sub-diagram. */
export default function C4FlowNode({ id, data }: NodeProps) {
  const d = data as C4FlowNodeData;

  return (
    <div style={{ position: 'relative', padding: '6px 10px', textAlign: 'center' }}>
      <Handle type="target" position={Position.Top} />

      <div style={{ fontSize: '9px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {d.nodeType}
      </div>
      <div style={{ fontWeight: 600, fontSize: '13px' }}>{d.label}</div>
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

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
