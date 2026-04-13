/**
 * Export utilities for the C4 Diagram editor.
 *
 * - exportCurrentLayerToPng: captures the visible ReactFlow canvas as a PNG file.
 * - exportProjectToPdf: generates an interactive PDF where each diagram is a page.
 *   Each page is rendered using jsPDF vector drawing primitives, reading node/edge
 *   data directly from the C4 project model.  No screenshots are taken, so the
 *   result is a clean, scalable, print-friendly document.
 *   Nodes with child diagrams have clickable links to their subdiagram page.
 *   Sub-diagram pages include a clickable "↑ Back" annotation that links to the parent.
 */

import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import type { C4Diagram, C4Edge, C4Node, C4Project } from './c4/types';

// ---------------------------------------------------------------------------
// PNG export
// ---------------------------------------------------------------------------

function triggerDownloadUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

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
// Interactive PDF export — vector rendering
// ---------------------------------------------------------------------------

/** A4 dimensions in pt */
const PAGE_W = 595;
const PAGE_H = 842;
/** Left/right and bottom margin */
const PDF_MARGIN = 32;
/** Title bar height at top of each page */
const TITLE_H = 28;
/** Back-button bounding box */
const BACK_BTN = { x: PDF_MARGIN, y: TITLE_H + 8, w: 72, h: 18 };

// ---------------------------------------------------------------------------
// Node colours — matches DiagramCanvas.tsx palette
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

const NODE_COLORS: Record<string, RGB> = {
  Person:      [29, 78, 216],
  System:      [15, 118, 110],
  SystemExt:   [100, 116, 139],
  Boundary:    [120, 53, 15],
  Container:   [6, 95, 70],
  ContainerDb: [76, 29, 149],
  Component:   [30, 58, 95],
};

const EDGE_STROKE: RGB = [148, 163, 184];
const EDGE_LABEL_BG: RGB = [30, 41, 59];

/** Arrowhead half-angle (radians from the shaft) — controls how "open" the arrow tip is. */
const ARROW_HALF_ANGLE = Math.PI * 0.82;

/** Vertical positions (fraction of node height) for UML Component port tabs. */
const COMPONENT_TAB_POSITIONS = [0.28, 0.52];

// ---------------------------------------------------------------------------
// Coordinate transform helpers
// ---------------------------------------------------------------------------

interface PdfTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Transform a diagram-space X coordinate to PDF page-space. */
function px(x: number, t: PdfTransform): number {
  return x * t.scale + t.offsetX;
}

/** Transform a diagram-space Y coordinate to PDF page-space. */
function py(y: number, t: PdfTransform): number {
  return y * t.scale + t.offsetY;
}

/** Scale a diagram-space distance to PDF page-space. */
function ps(s: number, t: PdfTransform): number {
  return s * t.scale;
}

function lighten(c: RGB, amount: number): RGB {
  return [Math.min(255, c[0] + amount), Math.min(255, c[1] + amount), Math.min(255, c[2] + amount)];
}

function darken(c: RGB, amount: number): RGB {
  return [Math.max(0, c[0] - amount), Math.max(0, c[1] - amount), Math.max(0, c[2] - amount)];
}

// ---------------------------------------------------------------------------
// Bounds computation & transform
// ---------------------------------------------------------------------------

function computeNodeBounds(
  nodes: C4Node[],
): { x: number; y: number; width: number; height: number } | null {
  if (nodes.length === 0) return null;
  const minX = Math.min(...nodes.map((n) => n.position.x));
  const minY = Math.min(...nodes.map((n) => n.position.y));
  const maxX = Math.max(...nodes.map((n) => n.position.x + n.size.width));
  const maxY = Math.max(...nodes.map((n) => n.position.y + n.size.height));
  return { x: minX, y: minY, width: Math.max(maxX - minX, 1), height: Math.max(maxY - minY, 1) };
}

/**
 * Compute a PdfTransform that maps diagram-space bounds into a PDF content
 * rectangle, preserving aspect ratio and centering the result.
 */
function computeTransform(
  bounds: { x: number; y: number; width: number; height: number },
  contentX: number,
  contentY: number,
  contentW: number,
  contentH: number,
  padding = 30,
): PdfTransform {
  const padded = {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };
  const scale = Math.min(contentW / padded.width, contentH / padded.height);
  const scaledW = padded.width * scale;
  const scaledH = padded.height * scale;
  return {
    scale,
    offsetX: contentX + (contentW - scaledW) / 2 - padded.x * scale,
    offsetY: contentY + (contentH - scaledH) / 2 - padded.y * scale,
  };
}

// ---------------------------------------------------------------------------
// Handle position helpers
// ---------------------------------------------------------------------------

function getHandlePosition(
  node: C4Node,
  handleId: string | undefined,
  isSource: boolean,
): { x: number; y: number } {
  const cx = node.position.x + node.size.width / 2;
  const top = node.position.y;
  const bottom = node.position.y + node.size.height;
  const left = node.position.x;
  const right = node.position.x + node.size.width;
  const cy = node.position.y + node.size.height / 2;

  if (!handleId) {
    return isSource ? { x: cx, y: bottom } : { x: cx, y: top };
  }
  if (handleId.includes('top')) return { x: cx, y: top };
  if (handleId.includes('bottom')) return { x: cx, y: bottom };
  if (handleId.includes('left')) return { x: left, y: cy };
  if (handleId.includes('right')) return { x: right, y: cy };
  return isSource ? { x: cx, y: bottom } : { x: cx, y: top };
}

// ---------------------------------------------------------------------------
// Edge drawing
// ---------------------------------------------------------------------------

function drawArrowhead(
  pdf: jsPDF,
  tipX: number,
  tipY: number,
  fromX: number,
  fromY: number,
  size = 5,
): void {
  const angle = Math.atan2(tipY - fromY, tipX - fromX);
  const a1 = angle + ARROW_HALF_ANGLE;
  const a2 = angle - ARROW_HALF_ANGLE;
  pdf.triangle(
    tipX,
    tipY,
    tipX + Math.cos(a1) * size,
    tipY + Math.sin(a1) * size,
    tipX + Math.cos(a2) * size,
    tipY + Math.sin(a2) * size,
    'F',
  );
}

function drawPdfEdge(
  pdf: jsPDF,
  edge: C4Edge,
  nodesMap: Record<string, C4Node>,
  t: PdfTransform,
): void {
  const src = nodesMap[edge.source];
  const tgt = nodesMap[edge.target];
  if (!src || !tgt) return;

  const from = getHandlePosition(src, edge.sourceHandle, true);
  const to = getHandlePosition(tgt, edge.targetHandle, false);

  const x1 = px(from.x, t);
  const y1 = py(from.y, t);
  const x2 = px(to.x, t);
  const y2 = py(to.y, t);

  // Line
  pdf.setDrawColor(...EDGE_STROKE);
  pdf.setLineWidth(0.8);
  pdf.setLineDashPattern([], 0);
  pdf.line(x1, y1, x2, y2);

  // Arrowheads
  const dir = edge.direction ?? 'forward';
  pdf.setFillColor(...EDGE_STROKE);
  if (dir === 'forward' || dir === 'bidirectional') {
    drawArrowhead(pdf, x2, y2, x1, y1);
  }
  if (dir === 'reverse' || dir === 'bidirectional') {
    drawArrowhead(pdf, x1, y1, x2, y2);
  }

  // Label
  if (edge.label) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    const tw = pdf.getTextWidth(edge.label);
    const labelW = tw + 8;
    const labelH = 14;
    pdf.setFillColor(...EDGE_LABEL_BG);
    pdf.roundedRect(mx - labelW / 2, my - labelH / 2, labelW, labelH, 3, 3, 'F');
    pdf.setTextColor(...EDGE_STROKE);
    pdf.text(edge.label, mx, my + 3, { align: 'center' });
  }
}

// ---------------------------------------------------------------------------
// Node shape drawing
// ---------------------------------------------------------------------------

function drawNodeShape(pdf: jsPDF, node: C4Node, t: PdfTransform): void {
  const color: RGB = NODE_COLORS[node.type] ?? [55, 65, 81];
  const x = px(node.position.x, t);
  const y = py(node.position.y, t);
  const w = ps(node.size.width, t);
  const h = ps(node.size.height, t);
  const r = Math.min(4, w * 0.03);
  const borderColor = lighten(color, 60);

  switch (node.type) {
    case 'Container': {
      pdf.setFillColor(...color);
      pdf.roundedRect(x, y, w, h, r, r, 'F');
      pdf.setDrawColor(...borderColor);
      pdf.setLineWidth(0.5);
      pdf.setLineDashPattern([], 0);
      pdf.roundedRect(x, y, w, h, r, r, 'S');
      // Header bar
      const headerH = Math.max(6, Math.min(8 * t.scale, h * 0.12));
      pdf.setFillColor(...darken(color, 25));
      pdf.rect(x + 0.5, y + 0.5, w - 1, headerH, 'F');
      // Three dots
      const dotR = Math.max(1, 1.5 * t.scale);
      const dotY = y + headerH / 2 + 0.5;
      pdf.setFillColor(200, 210, 220);
      pdf.circle(x + 5 * t.scale, dotY, dotR, 'F');
      pdf.circle(x + 9 * t.scale, dotY, dotR, 'F');
      pdf.circle(x + 13 * t.scale, dotY, dotR, 'F');
      break;
    }
    case 'Person': {
      const rx = Math.min(w * 0.2, 20);
      const ry = Math.min(h * 0.2, 20);
      pdf.setFillColor(...color);
      pdf.roundedRect(x, y, w, h, rx, ry, 'F');
      pdf.setDrawColor(...borderColor);
      pdf.setLineWidth(0.5);
      pdf.setLineDashPattern([], 0);
      pdf.roundedRect(x, y, w, h, rx, ry, 'S');
      break;
    }
    case 'SystemExt': {
      pdf.setFillColor(...color);
      pdf.roundedRect(x, y, w, h, r, r, 'F');
      pdf.setDrawColor(...borderColor);
      pdf.setLineWidth(0.8);
      pdf.setLineDashPattern([3, 2], 0);
      pdf.roundedRect(x, y, w, h, r, r, 'S');
      pdf.setLineDashPattern([], 0);
      break;
    }
    case 'Boundary': {
      pdf.setFillColor(250, 240, 225);
      pdf.roundedRect(x, y, w, h, r, r, 'F');
      pdf.setDrawColor(200, 150, 80);
      pdf.setLineWidth(0.8);
      pdf.setLineDashPattern([4, 2], 0);
      pdf.roundedRect(x, y, w, h, r, r, 'S');
      pdf.setLineDashPattern([], 0);
      break;
    }
    case 'ContainerDb': {
      const ery = Math.min(h * 0.1, 10 * t.scale);
      // Body
      pdf.setFillColor(...color);
      pdf.rect(x, y + ery, w, h - 2 * ery, 'F');
      // Bottom ellipse
      pdf.setFillColor(...color);
      pdf.ellipse(x + w / 2, y + h - ery, w / 2, ery, 'F');
      pdf.setDrawColor(...borderColor);
      pdf.setLineWidth(0.5);
      pdf.setLineDashPattern([], 0);
      pdf.ellipse(x + w / 2, y + h - ery, w / 2, ery, 'S');
      // Side lines
      pdf.line(x, y + ery, x, y + h - ery);
      pdf.line(x + w, y + ery, x + w, y + h - ery);
      // Top ellipse
      pdf.setFillColor(...darken(color, 20));
      pdf.ellipse(x + w / 2, y + ery, w / 2, ery, 'F');
      pdf.setDrawColor(...borderColor);
      pdf.ellipse(x + w / 2, y + ery, w / 2, ery, 'S');
      break;
    }
    case 'Component': {
      pdf.setFillColor(...color);
      pdf.roundedRect(x, y, w, h, r, r, 'F');
      pdf.setDrawColor(...borderColor);
      pdf.setLineWidth(0.5);
      pdf.setLineDashPattern([], 0);
      pdf.roundedRect(x, y, w, h, r, r, 'S');
      // UML port tabs on the right
      const tabW = Math.max(4, 6 * t.scale);
      const tabH = Math.max(3, 5 * t.scale);
      for (const pct of COMPONENT_TAB_POSITIONS) {
        const tabY = y + h * pct;
        pdf.setFillColor(...color);
        pdf.rect(x + w - 1, tabY, tabW, tabH, 'F');
        pdf.setDrawColor(...borderColor);
        pdf.rect(x + w - 1, tabY, tabW, tabH, 'S');
      }
      break;
    }
    default: {
      // System and fallback
      pdf.setFillColor(...color);
      pdf.roundedRect(x, y, w, h, r, r, 'F');
      pdf.setDrawColor(...borderColor);
      pdf.setLineWidth(0.5);
      pdf.setLineDashPattern([], 0);
      pdf.roundedRect(x, y, w, h, r, r, 'S');
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Node text drawing
// ---------------------------------------------------------------------------

function drawNodeText(pdf: jsPDF, node: C4Node, t: PdfTransform): void {
  const x = px(node.position.x, t);
  const y = py(node.position.y, t);
  const w = ps(node.size.width, t);
  const h = ps(node.size.height, t);
  const textCx = x + w / 2;
  const maxTextW = w - 8;

  // Font sizes (clamped for readability)
  const typeFontSz = Math.max(5, Math.min(7 * t.scale, 9));
  const nameFontSz = Math.max(7, Math.min(11 * t.scale, 14));
  const descFontSz = Math.max(5, Math.min(8 * t.scale, 10));
  const techFontSz = Math.max(4, Math.min(7 * t.scale, 8));

  // Compute wrapped lines for name & description
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(nameFontSz);
  const nameLines: string[] = pdf.splitTextToSize(node.label, maxTextW);

  let descLines: string[] = [];
  if (node.description) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(descFontSz);
    descLines = (pdf.splitTextToSize(node.description, maxTextW) as string[]).slice(0, 3);
  }

  // Total text block height (for vertical centering)
  let totalH = typeFontSz * 1.3;
  totalH += nameLines.length * nameFontSz * 1.2;
  if (descLines.length > 0) {
    totalH += 2 + descLines.length * descFontSz * 1.2;
  }
  if (node.technology) {
    totalH += 2 + techFontSz * 1.2;
  }

  const topPad = node.type === 'Container' ? Math.max(8, 10 * t.scale) : 4;
  const available = h - topPad - 4;
  let ty = y + topPad + Math.max(0, (available - totalH) / 2) + typeFontSz;

  // ---- Type label ----
  const isBoundary = node.type === 'Boundary';
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(typeFontSz);
  pdf.setTextColor(...(isBoundary ? [100, 60, 20] as RGB : [255, 255, 255] as RGB));
  pdf.text(node.type.toUpperCase(), textCx, ty, { align: 'center' });
  ty += typeFontSz * 1.3;

  // ---- Name ----
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(nameFontSz);
  pdf.setTextColor(...(isBoundary ? [100, 60, 20] as RGB : [255, 255, 255] as RGB));
  for (const line of nameLines) {
    pdf.text(line, textCx, ty, { align: 'center' });
    ty += nameFontSz * 1.2;
  }

  // ---- Description ----
  if (descLines.length > 0) {
    ty += 2;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(descFontSz);
    pdf.setTextColor(...(isBoundary ? [130, 90, 40] as RGB : [210, 220, 230] as RGB));
    for (const line of descLines) {
      pdf.text(line, textCx, ty, { align: 'center' });
      ty += descFontSz * 1.2;
    }
  }

  // ---- Technology ----
  if (node.technology) {
    ty += 2;
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(techFontSz);
    pdf.setTextColor(...(isBoundary ? [150, 110, 50] as RGB : [190, 200, 210] as RGB));
    pdf.text(`[${node.technology}]`, textCx, ty, { align: 'center' });
  }
}

// ---------------------------------------------------------------------------
// BFS traversal helper
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Public PDF export function
// ---------------------------------------------------------------------------

/**
 * Generates an interactive multi-page PDF of the whole project.
 *
 * Each page is rendered using jsPDF vector drawing primitives, reading
 * node positions, edge connections, and styling directly from the C4 data
 * model.  No screenshots are taken — the result is a clean, scalable,
 * print-friendly document.
 *
 * - One page per diagram (BFS order).
 * - White background with colored C4 node shapes.
 * - Nodes with a child diagram have a clickable region that links to the
 *   corresponding sub-diagram page.
 * - Sub-diagram pages include a clickable "↑ Back" link to their parent page.
 */
export async function exportProjectToPdf(project: C4Project, filename: string): Promise<void> {
  const ordered = bfsOrder(project);
  if (ordered.length === 0) return;

  // Build lookups: diagramId → 1-based page number, diagramId → parent
  const pageOf: Record<string, number> = {};
  ordered.forEach(({ diagram }, i) => {
    pageOf[diagram.id] = i + 1;
  });

  const parentOf: Record<string, string> = {};
  ordered.forEach(({ diagram, parentDiagramId }) => {
    if (parentDiagramId) parentOf[diagram.id] = parentDiagramId;
  });

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  // Store the transform used for each page so we can compute link rects later
  const pageTransforms: PdfTransform[] = [];

  const contentW = PAGE_W - PDF_MARGIN * 2;

  for (let i = 0; i < ordered.length; i++) {
    const { diagram } = ordered[i];
    if (i > 0) pdf.addPage();

    // ----- White background -----
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, PAGE_W, PAGE_H, 'F');

    // ----- Title bar -----
    pdf.setFillColor(12, 15, 26);
    pdf.rect(0, 0, PAGE_W, TITLE_H, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(139, 154, 176);
    pdf.text(diagram.title, PDF_MARGIN, TITLE_H - 8);

    // ----- Back button -----
    const isRoot = diagram.id === project.rootDiagramId;
    if (!isRoot) {
      const { x: bx, y: by, w: bw, h: bh } = BACK_BTN;
      pdf.setFillColor(30, 42, 66);
      pdf.roundedRect(bx, by, bw, bh, 4, 4, 'F');
      pdf.setDrawColor(50, 70, 110);
      pdf.setLineWidth(0.5);
      pdf.roundedRect(bx, by, bw, bh, 4, 4, 'S');
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(180, 200, 230);
      pdf.text('↑ Back', bx + bw / 2, by + bh / 2 + 3, { align: 'center' });
    }

    // ----- Content area -----
    const contentTop = isRoot ? TITLE_H + 8 : BACK_BTN.y + BACK_BTN.h + 8;
    const contentH = PAGE_H - contentTop - PDF_MARGIN;

    const bounds = computeNodeBounds(diagram.nodes);
    if (!bounds) {
      pageTransforms.push({ scale: 1, offsetX: 0, offsetY: 0 });
      continue;
    }

    const t = computeTransform(bounds, PDF_MARGIN, contentTop, contentW, contentH);
    pageTransforms.push(t);

    // Build a quick lookup for edge rendering
    const nodesMap: Record<string, C4Node> = {};
    for (const node of diagram.nodes) {
      nodesMap[node.id] = node;
    }

    // Draw edges first (they appear below nodes visually)
    for (const edge of diagram.edges) {
      drawPdfEdge(pdf, edge, nodesMap, t);
    }

    // Draw nodes on top
    for (const node of diagram.nodes) {
      drawNodeShape(pdf, node, t);
      drawNodeText(pdf, node, t);
    }
  }

  // ----- Interactive links (added after all pages are built) -----
  for (let i = 0; i < ordered.length; i++) {
    const { diagram } = ordered[i];
    pdf.setPage(i + 1);
    const t = pageTransforms[i];

    // Back button link
    const isRoot = diagram.id === project.rootDiagramId;
    if (!isRoot && parentOf[diagram.id]) {
      const parentPage = pageOf[parentOf[diagram.id]];
      if (parentPage !== undefined) {
        const { x: bx, y: by, w: bw, h: bh } = BACK_BTN;
        pdf.link(bx, by, bw, bh, { pageNumber: parentPage });
      }
    }

    // Drill-down node links
    for (const node of diagram.nodes) {
      if (!node.childDiagramId) continue;
      const targetPage = pageOf[node.childDiagramId];
      if (targetPage === undefined) continue;
      const nx = px(node.position.x, t);
      const ny = py(node.position.y, t);
      const nw = ps(node.size.width, t);
      const nh = ps(node.size.height, t);
      pdf.link(nx, ny, nw, nh, { pageNumber: targetPage });
    }
  }

  pdf.save(`${filename}.pdf`);
}

