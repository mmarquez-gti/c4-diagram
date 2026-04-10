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
  border: '2px solid rgba(255,255,255,0.9)',
  background: '#111827',
};

const hiddenHandleStyle = {
  width: 14,
  height: 14,
  border: 'none',
  background: 'transparent',
  opacity: 0,
};

/** Custom ReactFlow node that shows a drill-down icon when the node has a sub-diagram. */
export default function C4FlowNode({ id, data }: NodeProps) {
  const d = data as C4FlowNodeData;

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

      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          padding: '6px 10px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
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
      </div>
    </>
  );
}
