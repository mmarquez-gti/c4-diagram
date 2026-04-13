/**
 * Export utilities for the C4 Diagram editor.
 *
 * - exportCurrentLayerToPng: captures the visible ReactFlow canvas as a PNG file.
 * - exportProjectToPdf: generates an interactive PDF where each diagram is a page
 *   and nodes with child diagrams have clickable links to their subdiagram page.
 *   Sub-diagram pages include a clickable "↑ Back" annotation that links to the parent.
 *
 * The PDF rendering mirrors the web app appearance: shape-specific backgrounds
 * (cylinder for ContainerDb, header bar for Container, rounded-top for Person,
 * dashed border for Boundary/SystemExt, UML port tabs for Component), per-type
 * SVG-style icons, technology labels, and handle-aware edge routing.
 */

import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import type { C4Diagram, C4Node, C4Project } from './c4/types';

// ---------------------------------------------------------------------------
// PNG export
// ---------------------------------------------------------------------------

/**
 * Captures the ReactFlow canvas element as a PNG and triggers a download.
 * @param filename  Base filename without extension.
 */
export async function exportCurrentLayerToPng(filename: string): Promise<void> {
  const container = document.getElementById('diagram-canvas-container');
  if (!container) {
    throw new Error('Canvas container element not found.');
  }

  // Hide ReactFlow UI controls so they don't appear in the export
  const controls = container.querySelectorAll<HTMLElement>(
    '.react-flow__controls, .react-flow__minimap, .react-flow__attribution',
  );
  controls.forEach((el) => (el.style.visibility = 'hidden'));

  try {
    const dataUrl = await toPng(container, {
      backgroundColor: '#030712', // matches canvas bg (gray-950)
      pixelRatio: 2,
    });
    triggerDownloadUrl(dataUrl, `${filename}.png`);
  } finally {
    controls.forEach((el) => (el.style.visibility = ''));
  }
}

// ---------------------------------------------------------------------------
// Interactive PDF export
// ---------------------------------------------------------------------------

/** Margin (pt) around diagram content on each PDF page */
const PDF_MARGIN = 32;
/** Gap (pt) between dots in the background dot grid — matches ReactFlow BackgroundVariant.Dots gap={24} */
const DOT_GRID_GAP = 24;
/** A4 dimensions in pt */
const PAGE_W = 595;
const PAGE_H = 842;
/** Drawable area */
const DRAW_W = PAGE_W - PDF_MARGIN * 2;
const DRAW_H = PAGE_H - PDF_MARGIN * 2;

/** Back-button bounding box (pt) relative to top-left of drawable area */
const BACK_BTN = { x: 0, y: 0, w: 72, h: 18 };

// Colour palette matching the web app canvas (DiagramCanvas.tsx NODE_COLORS)
type RGB = [number, number, number];

const NODE_COLORS: Record<string, RGB> = {
  Person: [29, 78, 216],
  System: [15, 118, 110],
  SystemExt: [100, 116, 139],
  Boundary: [120, 53, 15],
  Container: [6, 95, 70],
  ContainerDb: [76, 29, 149],
  Component: [30, 58, 95],
};

const DEFAULT_COLOR: RGB = [55, 65, 81];

type Rect = { x: number; y: number; w: number; h: number };

// ---------------------------------------------------------------------------
// Icon drawing — mirrors the SVG icons in C4FlowNode.tsx
// ---------------------------------------------------------------------------

/**
 * Draw a node-type icon at the given centre point using jsPDF path primitives.
 * The icon is stroked in white (caller sets opacity via GState before calling).
 */
function drawNodeIcon(pdf: jsPDF, nodeType: string, cx: number, cy: number, size: number): void {
  const s = size / 24;
  const x0 = cx - size / 2;
  const y0 = cy - size / 2;
  const px = (x: number) => x0 + x * s;
  const py = (y: number) => y0 + y * s;

  pdf.setLineWidth(Math.max(0.4, 1.8 * s));
  pdf.setDrawColor(255, 255, 255);
  pdf.setFillColor(255, 255, 255);

  switch (nodeType) {
    case 'Person':
      // Head: circle cx=12 cy=7 r=4
      pdf.circle(px(12), py(7), 4 * s, 'S');
      // Body: M4 20 c0,-4.4 3.6,-8 8,-8 s8,3.6 8,8
      pdf.moveTo(px(4), py(20));
      pdf.curveTo(px(4), py(15.6), px(7.6), py(12), px(12), py(12));
      pdf.curveTo(px(16.4), py(12), px(20), py(15.6), px(20), py(20));
      pdf.stroke();
      break;

    case 'System':
      // Rect + two horizontal lines
      pdf.roundedRect(px(3), py(4), 18 * s, 14 * s, 2 * s, 2 * s, 'S');
      pdf.line(px(7), py(8), px(17), py(8));
      pdf.line(px(7), py(12), px(13), py(12));
      break;

    case 'SystemExt':
      // Dashed rect + two horizontal lines (dashed only on rect)
      pdf.setLineDashPattern([3 * s, 2 * s], 0);
      pdf.roundedRect(px(3), py(4), 18 * s, 14 * s, 2 * s, 2 * s, 'S');
      pdf.setLineDashPattern([], 0);
      pdf.line(px(7), py(8), px(17), py(8));
      pdf.line(px(7), py(12), px(13), py(12));
      break;

    case 'Container':
      // Rect + top horizontal line + two small dots
      pdf.roundedRect(px(3), py(6), 18 * s, 12 * s, 1 * s, 1 * s, 'S');
      pdf.line(px(3), py(10), px(21), py(10));
      pdf.circle(px(7), py(8), 0.8 * s, 'F');
      pdf.circle(px(10), py(8), 0.8 * s, 'F');
      break;

    case 'ContainerDb':
      // Top ellipse, side lines, bottom ellipse, middle ellipse
      pdf.ellipse(px(12), py(7), 8 * s, 3 * s, 'S');
      pdf.line(px(4), py(7), px(4), py(17));
      pdf.line(px(20), py(7), px(20), py(17));
      pdf.ellipse(px(12), py(17), 8 * s, 3 * s, 'S');
      pdf.ellipse(px(12), py(12), 8 * s, 3 * s, 'S');
      break;

    case 'Component':
      // Main rect + two small rects + two lines
      pdf.rect(px(5), py(5), 14 * s, 14 * s, 'S');
      pdf.rect(px(8), py(8), 3 * s, 3 * s, 'S');
      pdf.rect(px(8), py(13), 3 * s, 3 * s, 'S');
      pdf.line(px(13), py(9.5), px(16), py(9.5));
      pdf.line(px(13), py(14.5), px(16), py(14.5));
      break;

    case 'Boundary':
      // Dashed rect
      pdf.setLineDashPattern([4 * s, 2 * s], 0);
      pdf.roundedRect(px(3), py(3), 18 * s, 18 * s, 2 * s, 2 * s, 'S');
      pdf.setLineDashPattern([], 0);
      break;
  }
}

// ---------------------------------------------------------------------------
// Node shape backgrounds — mirrors ShapeBackground in C4FlowNode.tsx
// ---------------------------------------------------------------------------

/**
 * Draw the shape-specific background for a node.  Matches the web app shapes:
 * cylinder for ContainerDb, header-bar box for Container, rounded-top for Person,
 * dashed transparent rect for Boundary, dashed border for SystemExt,
 * port-tab box for Component, plain rounded rect for System/default.
 */
function drawNodeShape(pdf: jsPDF, node: C4Node, r: Rect): void {
  const { x, y, w, h } = r;
  const [cr, cg, cb] = NODE_COLORS[node.type] ?? DEFAULT_COLOR;
  const border: RGB = [180, 180, 180];
  const bw = 0.5;

  if (node.type === 'Boundary') {
    // Semi-transparent amber fill + dashed amber border
    pdf.saveGraphicsState();
    pdf.setGState(pdf.GState({ opacity: 0.18 }));
    pdf.setFillColor(120, 53, 15);
    pdf.roundedRect(x, y, w, h, 4, 4, 'F');
    pdf.restoreGraphicsState();
    pdf.setLineDashPattern([4, 2], 0);
    pdf.setDrawColor(200, 140, 60);
    pdf.setLineWidth(1);
    pdf.roundedRect(x, y, w, h, 4, 4, 'S');
    pdf.setLineDashPattern([], 0);
    return;
  }

  if (node.type === 'SystemExt') {
    // Solid fill + dashed white border
    pdf.setFillColor(cr, cg, cb);
    pdf.setLineDashPattern([3, 2], 0);
    pdf.setDrawColor(...border);
    pdf.setLineWidth(bw);
    pdf.roundedRect(x, y, w, h, 4, 4, 'FD');
    pdf.setLineDashPattern([], 0);
    return;
  }

  if (node.type === 'ContainerDb') {
    // Cylinder: top ellipse + body rect + bottom ellipse + dark top overlay
    const ryEll = h * 0.14;
    const rxEll = w / 2;
    const cyTop = y + ryEll;
    const cyBot = y + h - ryEll;
    const cxNode = x + w / 2;

    // Body rect (no stroke)
    pdf.setFillColor(cr, cg, cb);
    pdf.rect(x, cyTop, w, cyBot - cyTop, 'F');

    // Side lines
    pdf.setDrawColor(...border);
    pdf.setLineWidth(bw);
    pdf.line(x, cyTop, x, cyBot);
    pdf.line(x + w, cyTop, x + w, cyBot);

    // Bottom ellipse
    pdf.setFillColor(cr, cg, cb);
    pdf.setDrawColor(...border);
    pdf.setLineWidth(bw);
    pdf.ellipse(cxNode, cyBot, rxEll, ryEll, 'FD');

    // Top ellipse
    pdf.setFillColor(cr, cg, cb);
    pdf.ellipse(cxNode, cyTop, rxEll, ryEll, 'FD');

    // Dark shadow overlay on top ellipse (depth illusion)
    pdf.saveGraphicsState();
    pdf.setGState(pdf.GState({ opacity: 0.18 }));
    pdf.setFillColor(0, 0, 0);
    pdf.ellipse(cxNode, cyTop, rxEll, ryEll, 'F');
    pdf.restoreGraphicsState();
    return;
  }

  if (node.type === 'Container') {
    // Solid box + dark header strip + 3 dots (matching web app Container shape)
    const headerH = Math.max(8, h * 0.15);

    pdf.setFillColor(cr, cg, cb);
    pdf.setDrawColor(...border);
    pdf.setLineWidth(bw);
    pdf.roundedRect(x, y, w, h, 4, 4, 'FD');

    // Dark header strip (rounded top corners only — approximate with overlapping rects)
    pdf.saveGraphicsState();
    pdf.setGState(pdf.GState({ opacity: 0.28 }));
    pdf.setFillColor(0, 0, 0);
    pdf.roundedRect(x, y, w, headerH * 2, 4, 4, 'F'); // top rounded
    pdf.rect(x, y + headerH, w, headerH, 'F'); // cancel bottom rounding
    pdf.restoreGraphicsState();

    // Three dots
    const dotR = Math.max(1.5, headerH * 0.25);
    const dotY = y + headerH / 2;
    const dotSpacing = dotR * 2.5;
    const dotX0 = x + 5 + dotR;
    const containerHeaderDotOpacities = [0.55, 0.40, 0.25] as const;
    for (let i = 0; i < 3; i++) {
      pdf.saveGraphicsState();
      pdf.setGState(pdf.GState({ opacity: containerHeaderDotOpacities[i] }));
      pdf.setFillColor(255, 255, 255);
      pdf.circle(dotX0 + i * dotSpacing, dotY, dotR, 'F');
      pdf.restoreGraphicsState();
    }
    return;
  }

  if (node.type === 'Component') {
    // Solid box + two UML port tabs on the right side
    pdf.setFillColor(cr, cg, cb);
    pdf.setDrawColor(...border);
    pdf.setLineWidth(bw);
    pdf.roundedRect(x, y, w, h, 4, 4, 'FD');

    const tabW = Math.max(6, w * 0.06);
    const tabH = Math.max(5, h * 0.1);
    const tabX = x + w - tabW / 2;
    for (const topPct of [0.28, 0.52]) {
      const ty = y + h * topPct;
      pdf.setFillColor(cr, cg, cb);
      pdf.setDrawColor(...border);
      pdf.setLineWidth(bw);
      pdf.rect(tabX, ty, tabW, tabH, 'FD');
    }
    return;
  }

  if (node.type === 'Person') {
    // Rounded top shape: borderRadius '40% 40% 8px 8px' approximated with a custom path
    const topR = Math.min(w * 0.4, h * 0.4);
    const botR = Math.min(4, h * 0.1);
    // k = 4*(√2-1)/3 ≈ 0.5523: Bézier control-point ratio that approximates a quarter-circle arc
    const k = 0.5523;

    pdf.setFillColor(cr, cg, cb);
    pdf.setDrawColor(...border);
    pdf.setLineWidth(bw);

    pdf.moveTo(x + topR, y);
    pdf.lineTo(x + w - topR, y);
    pdf.curveTo(x + w - topR * (1 - k), y, x + w, y + topR * (1 - k), x + w, y + topR);
    pdf.lineTo(x + w, y + h - botR);
    pdf.curveTo(x + w, y + h - botR * (1 - k), x + w - botR * (1 - k), y + h, x + w - botR, y + h);
    pdf.lineTo(x + botR, y + h);
    pdf.curveTo(x + botR * (1 - k), y + h, x, y + h - botR * (1 - k), x, y + h - botR);
    pdf.lineTo(x, y + topR);
    pdf.curveTo(x, y + topR * (1 - k), x + topR * (1 - k), y, x + topR, y);
    pdf.close();
    pdf.fillStroke();
    return;
  }

  // Default / System: plain rounded rect
  pdf.setFillColor(cr, cg, cb);
  pdf.setDrawColor(...border);
  pdf.setLineWidth(bw);
  pdf.roundedRect(x, y, w, h, 4, 4, 'FD');
}

// ---------------------------------------------------------------------------
// Node content (icon + type label + name + description + technology)
// ---------------------------------------------------------------------------

/**
 * Draw text content inside a node, vertically centred.
 * Layout mirrors the web app: icon → type label → name → description → technology.
 * For Boundary nodes, the title is placed at the top-left corner instead.
 */
function drawNodeContent(pdf: jsPDF, node: C4Node, r: Rect, scale: number): void {
  const { x, y, w, h } = r;
  const cx = x + w / 2;

  // Horizontal padding inside node (mirrors web app's 12px side padding)
  const sidePad = Math.max(4, 10 * scale);
  const textWidth = Math.max(20, w - sidePad * 2);

  // Boundary: label at top-left (the interior is transparent/large)
  if (node.type === 'Boundary') {
    const boundaryLabelFontSize = Math.max(7, 9 * scale);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(boundaryLabelFontSize);
    pdf.setTextColor(200, 140, 60);
    const labelLines = pdf.splitTextToSize(node.label, textWidth) as string[];
    const labelStartY = y + Math.max(12, 14 * scale);
    labelLines.forEach((line: string, i: number) => {
      pdf.text(line, x + 8, labelStartY + i * boundaryLabelFontSize * 1.4);
    });
    if (node.description) {
      const boundaryDescFontSize = Math.max(6, 7 * scale);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(boundaryDescFontSize);
      pdf.saveGraphicsState();
      pdf.setGState(pdf.GState({ opacity: 0.75 }));
      const descLines = pdf.splitTextToSize(node.description, textWidth) as string[];
      const descStartY = labelStartY + labelLines.length * boundaryLabelFontSize * 1.4;
      descLines.forEach((line: string, i: number) => {
        pdf.text(line, x + 8, descStartY + i * boundaryDescFontSize * 1.4);
      });
      pdf.restoreGraphicsState();
    }
    return;
  }

  // Extra top padding (matching web app paddingTop per type)
  const paddingTopPx = node.type === 'Container' ? 17 : node.type === 'Person' ? 8 : 6;
  const paddingTop = paddingTopPx * scale;

  const iconSize = Math.max(10, Math.min(16 * scale, w * 0.22, (h - paddingTop) * 0.35));
  const typeFontSize = Math.max(5, 7 * scale);
  const nameFontSize = Math.max(6, 9 * scale);
  const descFontSize = Math.max(5, 7 * scale);
  const techFontSize = Math.max(5, 7 * scale);

  // Pre-split text into wrapped lines (font must be set before splitTextToSize
  // so that jsPDF uses the correct character metrics for line-breaking).
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(nameFontSize);
  const nameLines = pdf.splitTextToSize(node.label, textWidth) as string[];

  let descLines: string[] = [];
  if (node.description) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(descFontSize);
    descLines = pdf.splitTextToSize(node.description, textWidth) as string[];
  }

  let techLines: string[] = [];
  if (node.technology) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(techFontSize);
    techLines = pdf.splitTextToSize(`[${node.technology}]`, textWidth) as string[];
  }

  // Line heights account for the actual number of wrapped lines
  const lineIcon = iconSize + 2 * scale;
  const lineType = typeFontSize * 1.4;
  const lineName = nameFontSize * 1.4 * nameLines.length;
  const lineDesc = descLines.length > 0 ? descFontSize * 1.4 * descLines.length : 0;
  const lineTech = techLines.length > 0 ? techFontSize * 1.4 * techLines.length : 0;

  const totalH = lineIcon + lineType + lineName + lineDesc + lineTech;
  const availH = h - paddingTop - 4 * scale;
  const startY = y + paddingTop + Math.max(0, (availH - totalH) / 2);

  let curY = startY;

  // Icon
  pdf.saveGraphicsState();
  pdf.setGState(pdf.GState({ opacity: 0.85 }));
  drawNodeIcon(pdf, node.type, cx, curY + iconSize / 2, iconSize);
  pdf.restoreGraphicsState();
  curY += lineIcon;

  // Type label
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(typeFontSize);
  pdf.setTextColor(255, 255, 255);
  pdf.saveGraphicsState();
  pdf.setGState(pdf.GState({ opacity: 0.65 }));
  pdf.text(node.type.toUpperCase(), cx, curY, { align: 'center' });
  pdf.restoreGraphicsState();
  curY += lineType;

  // Name (wrapped)
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(nameFontSize);
  pdf.setTextColor(255, 255, 255);
  nameLines.forEach((line: string, i: number) => {
    pdf.text(line, cx, curY + i * nameFontSize * 1.4, { align: 'center' });
  });
  curY += lineName;

  // Description (wrapped)
  if (descLines.length > 0) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(descFontSize);
    pdf.setTextColor(255, 255, 255);
    pdf.saveGraphicsState();
    pdf.setGState(pdf.GState({ opacity: 0.75 }));
    descLines.forEach((line: string, i: number) => {
      pdf.text(line, cx, curY + i * descFontSize * 1.4, { align: 'center' });
    });
    pdf.restoreGraphicsState();
    curY += lineDesc;
  }

  // Technology (wrapped)
  if (techLines.length > 0) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(techFontSize);
    pdf.setTextColor(255, 255, 255);
    pdf.saveGraphicsState();
    pdf.setGState(pdf.GState({ opacity: 0.6 }));
    techLines.forEach((line: string, i: number) => {
      pdf.text(line, cx, curY + i * techFontSize * 1.4, { align: 'center' });
    });
    pdf.restoreGraphicsState();
  }
}

// ---------------------------------------------------------------------------
// Edge helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the PDF-space connection point for an edge endpoint.
 * Uses the handle identifier (e.g. "source-top") to pick the correct side;
 * falls back to the node centre when no handle is specified.
 */
function getHandlePoint(rect: Rect, handle: string | undefined): { x: number; y: number } {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  if (!handle) return { x: cx, y: cy };
  if (handle.includes('top')) return { x: cx, y: rect.y };
  if (handle.includes('right')) return { x: rect.x + rect.w, y: cy };
  if (handle.includes('bottom')) return { x: cx, y: rect.y + rect.h };
  if (handle.includes('left')) return { x: rect.x, y: cy };
  return { x: cx, y: cy };
}

/** Draw a filled arrowhead triangle pointing in the given direction (angle in radians). */
function drawArrowhead(
  pdf: jsPDF,
  tipX: number,
  tipY: number,
  angle: number,
  ahl: number,
  ahw: number,
): void {
  const ax = tipX - ahl * Math.cos(angle);
  const ay = tipY - ahl * Math.sin(angle);
  pdf.triangle(
    tipX,
    tipY,
    ax - ahw * Math.sin(angle),
    ay + ahw * Math.cos(angle),
    ax + ahw * Math.sin(angle),
    ay - ahw * Math.cos(angle),
    'F',
  );
}

// ---------------------------------------------------------------------------
// BFS / layout helpers (unchanged from original)
// ---------------------------------------------------------------------------

/**
 * BFS traversal of the project diagram tree, returning diagrams in BFS order
 * together with the ID of their parent diagram (or null for root).
 */
function bfsOrder(
  project: C4Project,
): Array<{ diagram: C4Diagram; parentDiagramId: string | null }> {
  const result: Array<{ diagram: C4Diagram; parentDiagramId: string | null }> = [];
  const queue: Array<{ diagId: string; parentDiagramId: string | null }> = [
    { diagId: project.rootDiagramId, parentDiagramId: null },
  ];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { diagId, parentDiagramId } = queue.shift()!;
    if (visited.has(diagId)) continue;
    visited.add(diagId);

    const diagram = project.diagrams[diagId];
    if (!diagram) continue;

    result.push({ diagram, parentDiagramId });

    for (const node of diagram.nodes) {
      if (node.childDiagramId && project.diagrams[node.childDiagramId]) {
        queue.push({ diagId: node.childDiagramId, parentDiagramId: diagId });
      }
    }
  }

  return result;
}

/**
 * Compute scaling + translation to fit all nodes inside the drawable page area.
 */
function computeLayout(
  nodes: C4Node[],
  hasBackButton: boolean,
): {
  scale: number;
  offsetX: number;
  offsetY: number;
  availH: number;
} {
  if (nodes.length === 0) {
    return { scale: 1, offsetX: 0, offsetY: hasBackButton ? BACK_BTN.h + 12 : 0, availH: DRAW_H };
  }

  const extraTop = hasBackButton ? BACK_BTN.h + 12 : 0;
  const availH = DRAW_H - extraTop;

  const minX = Math.min(...nodes.map((n) => n.position.x));
  const minY = Math.min(...nodes.map((n) => n.position.y));
  const maxX = Math.max(...nodes.map((n) => n.position.x + n.size.width));
  const maxY = Math.max(...nodes.map((n) => n.position.y + n.size.height));

  const contentW = maxX - minX || 1;
  const contentH = maxY - minY || 1;

  const scale = Math.min(DRAW_W / contentW, availH / contentH, 1);
  const scaledW = contentW * scale;
  const scaledH = contentH * scale;

  // Centre the content in the available area
  const offsetX = (DRAW_W - scaledW) / 2 - minX * scale;
  const offsetY = extraTop + (availH - scaledH) / 2 - minY * scale;

  return { scale, offsetX, offsetY, availH };
}

/**
 * Returns the PDF-page coordinates (pt) of a node's bounding box,
 * translated and scaled from diagram coordinates.
 */
function nodePageRect(node: C4Node, scale: number, offsetX: number, offsetY: number): Rect {
  return {
    x: PDF_MARGIN + node.position.x * scale + offsetX,
    y: PDF_MARGIN + node.position.y * scale + offsetY,
    w: node.size.width * scale,
    h: node.size.height * scale,
  };
}

// ---------------------------------------------------------------------------
// Page renderer
// ---------------------------------------------------------------------------

/**
 * Draw a single diagram onto the current jsPDF page.
 * Returns node rects for use in interactive link generation.
 */
function drawDiagramPage(
  pdf: jsPDF,
  diagram: C4Diagram,
  hasBackButton: boolean,
): Array<{ node: C4Node; rect: Rect }> {
  const { scale, offsetX, offsetY } = computeLayout(diagram.nodes, hasBackButton);

  // ----- Background -----
  pdf.setFillColor(3, 7, 18); // gray-950
  pdf.rect(0, 0, PAGE_W, PAGE_H, 'F');

  // Dot-grid background (matching ReactFlow Background component)
  pdf.saveGraphicsState();
  pdf.setGState(pdf.GState({ opacity: 0.08 }));
  pdf.setFillColor(107, 114, 128); // gray-500
  for (let gx = PDF_MARGIN % DOT_GRID_GAP; gx < PAGE_W; gx += DOT_GRID_GAP) {
    for (let gy = PDF_MARGIN % DOT_GRID_GAP + 28; gy < PAGE_H; gy += DOT_GRID_GAP) {
      pdf.circle(gx, gy, 0.8, 'F');
    }
  }
  pdf.restoreGraphicsState();

  // ----- Title bar -----
  pdf.setFillColor(12, 15, 26); // header dark (#0c0f1a)
  pdf.rect(0, 0, PAGE_W, 28, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(139, 154, 176); // #8b9ab0
  pdf.text(diagram.title, PDF_MARGIN, 18);

  // ----- Back button -----
  if (hasBackButton) {
    const bx = PDF_MARGIN + BACK_BTN.x;
    const by = PDF_MARGIN + BACK_BTN.y;
    pdf.setFillColor(30, 42, 66);
    pdf.roundedRect(bx, by, BACK_BTN.w, BACK_BTN.h, 4, 4, 'F');
    pdf.setDrawColor(50, 70, 110);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(bx, by, BACK_BTN.w, BACK_BTN.h, 4, 4, 'S');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(180, 200, 230);
    pdf.text('↑ Back', bx + BACK_BTN.w / 2, by + BACK_BTN.h / 2 + 3, { align: 'center' });
  }

  // ----- Edges -----
  // Draw Boundary nodes first (behind all other nodes and edges)
  const boundaryNodes = diagram.nodes.filter((n) => n.type === 'Boundary');
  const regularNodes = diagram.nodes.filter((n) => n.type !== 'Boundary');

  const nodeRectMap = new Map<string, Rect>();
  for (const node of diagram.nodes) {
    nodeRectMap.set(node.id, nodePageRect(node, scale, offsetX, offsetY));
  }

  for (const node of boundaryNodes) {
    const r = nodeRectMap.get(node.id)!;
    drawNodeShape(pdf, node, r);
    drawNodeContent(pdf, node, r, scale);
  }

  // Draw edges before regular nodes so nodes render on top
  const edgeColor: RGB = [148, 163, 184]; // slate-400
  pdf.setDrawColor(...edgeColor);
  pdf.setLineWidth(0.8);

  for (const edge of diagram.edges) {
    const src = diagram.nodes.find((n) => n.id === edge.source);
    const tgt = diagram.nodes.find((n) => n.id === edge.target);
    if (!src || !tgt) continue;

    const srcRect = nodeRectMap.get(src.id)!;
    const tgtRect = nodeRectMap.get(tgt.id)!;

    // Use handle positions for accurate edge routing
    const p1 = getHandlePoint(srcRect, edge.sourceHandle);
    const p2 = getHandlePoint(tgtRect, edge.targetHandle);

    pdf.setDrawColor(...edgeColor);
    pdf.setLineWidth(0.8);
    pdf.line(p1.x, p1.y, p2.x, p2.y);

    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const ahl = 6;
    const ahw = 3;

    pdf.setFillColor(...edgeColor);

    const direction = edge.direction ?? 'forward';
    if (direction !== 'none' && direction !== 'reverse') {
      drawArrowhead(pdf, p2.x, p2.y, angle, ahl, ahw);
    }
    if (direction === 'reverse' || direction === 'bidirectional') {
      drawArrowhead(pdf, p1.x, p1.y, angle + Math.PI, ahl, ahw);
    }

    // Edge label + technology
    if (edge.label || edge.technology) {
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const labelFontSize = Math.max(6, 7 * scale);

      // Small label background pill
      if (edge.label) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(labelFontSize);
        pdf.setTextColor(148, 163, 184);
        pdf.text(edge.label, mx, my - 2, { align: 'center' });
      }
      if (edge.technology) {
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(Math.max(5, 6 * scale));
        pdf.setTextColor(148, 163, 184);
        const techY = edge.label ? my + labelFontSize : my - 2;
        pdf.text(`[${edge.technology}]`, mx, techY, { align: 'center' });
      }
    }
  }

  // ----- Regular nodes -----
  const nodeRects: Array<{ node: C4Node; rect: Rect }> = [];

  for (const node of regularNodes) {
    const r = nodeRectMap.get(node.id)!;
    nodeRects.push({ node, rect: r });

    drawNodeShape(pdf, node, r);
    drawNodeContent(pdf, node, r, scale);

    // Drill-down indicator (magnifying-glass style badge, top-right corner)
    if (node.childDiagramId) {
      const badgeSize = Math.max(8, 10 * scale);
      const ix = r.x + r.w - badgeSize - 3;
      const iy = r.y + 3;

      pdf.saveGraphicsState();
      pdf.setGState(pdf.GState({ opacity: 0.5 }));
      pdf.setFillColor(0, 0, 0);
      pdf.roundedRect(ix, iy, badgeSize, badgeSize, 1.5, 1.5, 'F');
      pdf.restoreGraphicsState();

      // Magnifying glass icon (circle + handle)
      const ic = badgeSize * 0.44; // circle radius
      const icx = ix + badgeSize * 0.42;
      const icy = iy + badgeSize * 0.42;
      pdf.setDrawColor(255, 255, 255);
      pdf.setLineWidth(Math.max(0.4, 1.2 * scale));
      pdf.circle(icx, icy, ic, 'S');
      const hx1 = ix + badgeSize * 0.65;
      const hy1 = iy + badgeSize * 0.65;
      pdf.line(hx1, hy1, ix + badgeSize - 1.5, iy + badgeSize - 1.5);
    }
  }

  // Also add boundary nodes to nodeRects for link generation
  for (const node of boundaryNodes) {
    nodeRects.push({ node, rect: nodeRectMap.get(node.id)! });
  }

  return nodeRects;
}

// ---------------------------------------------------------------------------
// Public PDF export function
// ---------------------------------------------------------------------------

/**
 * Generates an interactive multi-page PDF of the whole project.
 * - One page per diagram (BFS order).
 * - Nodes with a child diagram have a clickable region that links to the
 *   corresponding sub-diagram page.
 * - Sub-diagram pages include a clickable "↑ Back" link to their parent page.
 */
export function exportProjectToPdf(project: C4Project, filename: string): void {
  const ordered = bfsOrder(project);
  if (ordered.length === 0) return;

  // Build a lookup: diagramId → 1-based page number
  const pageOf: Record<string, number> = {};
  ordered.forEach(({ diagram }, i) => {
    pageOf[diagram.id] = i + 1;
  });

  // Build a lookup: diagramId → parent diagramId
  const parentOf: Record<string, string> = {};
  ordered.forEach(({ diagram, parentDiagramId }) => {
    if (parentDiagramId) parentOf[diagram.id] = parentDiagramId;
  });

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  ordered.forEach(({ diagram }, pageIndex) => {
    if (pageIndex > 0) pdf.addPage();

    const isRoot = diagram.id === project.rootDiagramId;
    const hasBackButton = !isRoot;

    const nodeRects = drawDiagramPage(pdf, diagram, hasBackButton);

    // ----- Interactive links: back button -----
    if (hasBackButton && parentOf[diagram.id]) {
      const parentPage = pageOf[parentOf[diagram.id]];
      if (parentPage !== undefined) {
        const bx = PDF_MARGIN + BACK_BTN.x;
        const by = PDF_MARGIN + BACK_BTN.y;
        pdf.link(bx, by, BACK_BTN.w, BACK_BTN.h, { pageNumber: parentPage });
      }
    }

    // ----- Interactive links: drill-down nodes -----
    for (const { node, rect } of nodeRects) {
      if (!node.childDiagramId) continue;
      const targetPage = pageOf[node.childDiagramId];
      if (targetPage === undefined) continue;
      pdf.link(rect.x, rect.y, rect.w, rect.h, { pageNumber: targetPage });
    }
  });

  pdf.save(`${filename}.pdf`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function triggerDownloadUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
