'use client';

import { useCallback, useMemo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  type Edge,
  getStraightPath,
  getBezierPath,
  getSmoothStepPath,
  useReactFlow,
} from '@xyflow/react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CustomEdgeData extends Record<string, unknown> {
  pathMode?: 'bezier' | 'straight' | 'orthogonal';
  bendPoints?: Array<{ x: number; y: number }>;
  labelOffsetX?: number;
  labelOffsetY?: number;
  onBendPointsChange?: (edgeId: string, bendPoints: Array<{ x: number; y: number }>) => void;
  onLabelOffsetChange?: (edgeId: string, offsetX: number, offsetY: number) => void;
  onAddBendPoint?: (edgeId: string, index: number, point: { x: number; y: number }) => void;
  isSelected?: boolean;
}

type CustomEdgeProps = EdgeProps<Edge<CustomEdgeData>>;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** Build an SVG path string through all points. For 'straight' mode: line segments. */
function buildStraightPath(
  points: Array<{ x: number; y: number }>,
): string {
  if (points.length < 2) return '';
  const [first, ...rest] = points;
  return `M ${first.x},${first.y}` + rest.map((p) => ` L ${p.x},${p.y}`).join('');
}

/** Build an SVG path string through all points using cubic Bezier curves. */
function buildBezierPath(
  points: Array<{ x: number; y: number }>,
): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    // Simple curve between two points
    const [a, b] = points;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const cx1 = a.x + dx * 0.25;
    const cy1 = a.y + dy * 0.5;
    const cx2 = b.x - dx * 0.25;
    const cy2 = b.y - dy * 0.5;
    return `M ${a.x},${a.y} C ${cx1},${cy1} ${cx2},${cy2} ${b.x},${b.y}`;
  }

  // Through multiple points: use Catmull-Rom spline converted to cubic Bezier
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    // Catmull-Rom to cubic Bezier control points
    const smoothnessDivisor = 6;
    const cx1 = p1.x + (p2.x - p0.x) / smoothnessDivisor;
    const cy1 = p1.y + (p2.y - p0.y) / smoothnessDivisor;
    const cx2 = p2.x - (p3.x - p1.x) / smoothnessDivisor;
    const cy2 = p2.y - (p3.y - p1.y) / smoothnessDivisor;

    d += ` C ${cx1},${cy1} ${cx2},${cy2} ${p2.x},${p2.y}`;
  }
  return d;
}

/** Build an SVG path for orthogonal (right-angle) routing through waypoints. */
function buildOrthogonalPath(
  points: Array<{ x: number; y: number }>,
): string {
  if (points.length < 2) return '';
  const [first, ...rest] = points;
  let d = `M ${first.x},${first.y}`;

  for (let i = 0; i < rest.length; i++) {
    const prev = i === 0 ? first : rest[i - 1];
    const curr = rest[i];

    // Route orthogonally: horizontal first, then vertical
    d += ` L ${curr.x},${prev.y} L ${curr.x},${curr.y}`;
  }
  return d;
}

/** Compute the midpoint of an SVG path by parameterizing it. */
function getPathMidpoint(
  points: Array<{ x: number; y: number }>,
): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  // Compute total length
  let totalLen = 0;
  const segments: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    segments.push(len);
    totalLen += len;
  }

  // Walk to the midpoint
  const halfLen = totalLen / 2;
  let walked = 0;
  for (let i = 0; i < segments.length; i++) {
    if (walked + segments[i] >= halfLen) {
      const frac = (halfLen - walked) / segments[i];
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * frac,
        y: points[i].y + (points[i + 1].y - points[i].y) * frac,
      };
    }
    walked += segments[i];
  }
  return points[points.length - 1];
}

// ---------------------------------------------------------------------------
// Custom edge component
// ---------------------------------------------------------------------------

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerStart,
  markerEnd,
  label,
  labelStyle,
  labelBgStyle,
  data,
  selected,
}: CustomEdgeProps) {
  const reactFlow = useReactFlow();
  const pathMode = data?.pathMode ?? 'bezier';
  const bendPoints = data?.bendPoints ?? [];
  const labelOffsetX = data?.labelOffsetX ?? 0;
  const labelOffsetY = data?.labelOffsetY ?? 0;
  const isSelected = data?.isSelected ?? selected;

  // Full set of points: source -> bendPoints -> target
  const allPoints = useMemo(
    () => [
      { x: sourceX, y: sourceY },
      ...bendPoints,
      { x: targetX, y: targetY },
    ],
    [sourceX, sourceY, bendPoints, targetX, targetY],
  );

  // Build the SVG path
  const { edgePath, labelX, labelY } = useMemo(() => {
    let path: string;

    if (bendPoints.length === 0) {
      // No bend points — use React Flow's built-in path generators for cleaner results
      if (pathMode === 'straight') {
        const [p, lx, ly] = getStraightPath({ sourceX, sourceY, targetX, targetY });
        return { edgePath: p, labelX: lx + labelOffsetX, labelY: ly + labelOffsetY };
      }
      if (pathMode === 'orthogonal') {
        const [p, lx, ly] = getSmoothStepPath({
          sourceX,
          sourceY,
          targetX,
          targetY,
          sourcePosition,
          targetPosition,
          borderRadius: 0,
        });
        return { edgePath: p, labelX: lx + labelOffsetX, labelY: ly + labelOffsetY };
      }
      // Default: bezier
      const [p, lx, ly] = getBezierPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
      });
      return { edgePath: p, labelX: lx + labelOffsetX, labelY: ly + labelOffsetY };
    }

    // With bend points — use custom path building
    switch (pathMode) {
      case 'straight':
        path = buildStraightPath(allPoints);
        break;
      case 'orthogonal':
        path = buildOrthogonalPath(allPoints);
        break;
      case 'bezier':
      default:
        path = buildBezierPath(allPoints);
        break;
    }

    const mid = getPathMidpoint(allPoints);
    return { edgePath: path, labelX: mid.x + labelOffsetX, labelY: mid.y + labelOffsetY };
  }, [
    pathMode,
    bendPoints,
    allPoints,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    labelOffsetX,
    labelOffsetY,
  ]);

  // Double-click on the edge path adds a bend point at the click position
  const handlePathDoubleClick = useCallback(
    (e: React.MouseEvent<SVGPathElement>) => {
      if (!data?.onAddBendPoint) return;

      // Convert screen coords to flow coordinates using ReactFlow's utility
      const flowPoint = reactFlow.screenToFlowPosition({ x: e.clientX, y: e.clientY });

      // Find the best segment index to insert the bend point
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < allPoints.length - 1; i++) {
        const a = allPoints[i];
        const b = allPoints[i + 1];
        const dist = pointToSegmentDist(flowPoint.x, flowPoint.y, a.x, a.y, b.x, b.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }

      // Insert after the first point of the best segment (which is index in bendPoints)
      data.onAddBendPoint(id, bestIdx, { x: flowPoint.x, y: flowPoint.y });
    },
    [id, data, allPoints, reactFlow],
  );

  // Handle dragging a bend point
  const handleBendPointMouseDown = useCallback(
    (e: React.MouseEvent, bpIndex: number) => {
      e.stopPropagation();
      e.preventDefault();

      if (!data?.onBendPointsChange) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const origPoint = bendPoints[bpIndex];

      const handleMouseMove = (moveEvt: MouseEvent) => {
        const zoom = reactFlow.getViewport().zoom;
        const dx = (moveEvt.clientX - startX) / zoom;
        const dy = (moveEvt.clientY - startY) / zoom;

        const newBendPoints = [...bendPoints];
        newBendPoints[bpIndex] = {
          x: origPoint.x + dx,
          y: origPoint.y + dy,
        };
        data.onBendPointsChange!(id, newBendPoints);
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [id, data, bendPoints, reactFlow],
  );

  // Handle dragging the label (2D: both X and Y)
  const handleLabelMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (!data?.onLabelOffsetChange) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const origOffsetX = labelOffsetX;
      const origOffsetY = labelOffsetY;

      const handleMouseMove = (moveEvt: MouseEvent) => {
        const zoom = reactFlow.getViewport().zoom;
        const dx = (moveEvt.clientX - startX) / zoom;
        const dy = (moveEvt.clientY - startY) / zoom;
        data.onLabelOffsetChange!(id, origOffsetX + dx, origOffsetY + dy);
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [id, data, labelOffsetX, labelOffsetY, reactFlow],
  );

  return (
    <>
      {/* Invisible wider path for easier clicking & double-click to add bend points */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onDoubleClick={handlePathDoubleClick}
        style={{ cursor: isSelected ? 'crosshair' : 'pointer' }}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        style={style}
        markerStart={markerStart}
        markerEnd={markerEnd}
      />

      {/* Bend point handles (visible when edge is selected) */}
      {isSelected &&
        bendPoints.map((bp, idx) => (
          <g key={`bp-${idx}`}>
            {/* Outer ring */}
            <circle
              cx={bp.x}
              cy={bp.y}
              r={6}
              fill="#1e293b"
              stroke="#facc15"
              strokeWidth={2}
              style={{ cursor: 'grab' }}
              onMouseDown={(e) => handleBendPointMouseDown(e, idx)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                // Double-click on bend point to remove it
                if (data?.onBendPointsChange) {
                  const newBps = bendPoints.filter((_, i) => i !== idx);
                  data.onBendPointsChange(id, newBps);
                }
              }}
            />
            {/* Inner dot */}
            <circle cx={bp.x} cy={bp.y} r={2.5} fill="#facc15" pointerEvents="none" />
          </g>
        ))}

      {/* Label */}
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              cursor: 'move',
              userSelect: 'none',
            }}
            className="nodrag nopan"
            onMouseDown={handleLabelMouseDown}
          >
            <div
              style={{
                padding: '2px 6px',
                borderRadius: 3,
                fontSize: 11,
                ...(labelBgStyle as React.CSSProperties),
              }}
            >
              <span style={labelStyle as React.CSSProperties}>{label}</span>
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Utility: distance from point to line segment
// ---------------------------------------------------------------------------

function pointToSegmentDist(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return Math.hypot(px - projX, py - projY);
}
