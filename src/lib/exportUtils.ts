/**
 * Export utilities for the C4 Diagram editor.
 *
 * - exportCurrentLayerToPng: captures the visible ReactFlow canvas as a PNG file.
 * - exportProjectToPdf: generates an interactive PDF where each diagram is a page
 *   and nodes with child diagrams have clickable links to their subdiagram page.
 *   Sub-diagram pages include a clickable "↑ Back" annotation that links to the parent.
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
/** A4 dimensions in pt */
const PAGE_W = 595;
const PAGE_H = 842;
/** Drawable area */
const DRAW_W = PAGE_W - PDF_MARGIN * 2;
const DRAW_H = PAGE_H - PDF_MARGIN * 2;

/** Back-button bounding box (pt) relative to top-left of drawable area */
const BACK_BTN = { x: 0, y: 0, w: 72, h: 18 };

// Colour palette matching the canvas
const NODE_COLORS: Record<string, [number, number, number]> = {
  Person: [29, 78, 216],
  System: [15, 118, 110],
  SystemExt: [100, 116, 139],
  Boundary: [120, 53, 15],
  Container: [6, 95, 70],
  ContainerDb: [76, 29, 149],
  Component: [30, 58, 95],
};

const DEFAULT_COLOR: [number, number, number] = [55, 65, 81];

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
function nodePageRect(
  node: C4Node,
  scale: number,
  offsetX: number,
  offsetY: number,
): { x: number; y: number; w: number; h: number } {
  return {
    x: PDF_MARGIN + node.position.x * scale + offsetX,
    y: PDF_MARGIN + node.position.y * scale + offsetY,
    w: node.size.width * scale,
    h: node.size.height * scale,
  };
}

/**
 * Draw a single diagram onto the current jsPDF page.
 */
function drawDiagramPage(
  pdf: jsPDF,
  diagram: C4Diagram,
  hasBackButton: boolean,
): Array<{ node: C4Node; rect: { x: number; y: number; w: number; h: number } }> {
  const { scale, offsetX, offsetY } = computeLayout(diagram.nodes, hasBackButton);

  // ----- Background -----
  pdf.setFillColor(3, 7, 18); // gray-950
  pdf.rect(0, 0, PAGE_W, PAGE_H, 'F');

  // ----- Title bar -----
  pdf.setFillColor(12, 15, 26); // header dark
  pdf.rect(0, 0, PAGE_W, 28, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(139, 154, 176);
  pdf.text(diagram.title, PDF_MARGIN, 18);

  // ----- Back button (drawn as a rounded pill) -----
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
  pdf.setDrawColor(148, 163, 184); // slate-400
  pdf.setLineWidth(0.8);

  for (const edge of diagram.edges) {
    const src = diagram.nodes.find((n) => n.id === edge.source);
    const tgt = diagram.nodes.find((n) => n.id === edge.target);
    if (!src || !tgt) continue;

    // Centre-to-centre line
    const srcRect = nodePageRect(src, scale, offsetX, offsetY);
    const tgtRect = nodePageRect(tgt, scale, offsetX, offsetY);
    const x1 = srcRect.x + srcRect.w / 2;
    const y1 = srcRect.y + srcRect.h / 2;
    const x2 = tgtRect.x + tgtRect.w / 2;
    const y2 = tgtRect.y + tgtRect.h / 2;

    pdf.line(x1, y1, x2, y2);

    // Tiny arrowhead
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const ahl = 6;
    const ahw = 3;
    const ax = x2 - ahl * Math.cos(angle);
    const ay = y2 - ahl * Math.sin(angle);
    pdf.setFillColor(148, 163, 184);
    pdf.triangle(
      x2,
      y2,
      ax - ahw * Math.sin(angle),
      ay + ahw * Math.cos(angle),
      ax + ahw * Math.sin(angle),
      ay - ahw * Math.cos(angle),
      'F',
    );

    // Edge label
    if (edge.label) {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(148, 163, 184);
      pdf.text(edge.label, mx, my - 3, { align: 'center' });
    }
  }

  // ----- Nodes -----
  const nodeRects: Array<{ node: C4Node; rect: { x: number; y: number; w: number; h: number } }> =
    [];

  for (const node of diagram.nodes) {
    const r = nodePageRect(node, scale, offsetX, offsetY);
    nodeRects.push({ node, rect: r });

    const [cr, cg, cb] = NODE_COLORS[node.type] ?? DEFAULT_COLOR;

    // Node background
    if (node.type === 'Boundary') {
      // Semi-transparent fill for boundary nodes
      pdf.saveGraphicsState();
      pdf.setGState(pdf.GState({ opacity: 0.18 }));
      pdf.setFillColor(120, 53, 15);
      pdf.setDrawColor(200, 140, 60);
      pdf.setLineWidth(1);
      pdf.roundedRect(r.x, r.y, r.w, r.h, 4, 4, 'F');
      pdf.restoreGraphicsState();
      pdf.setDrawColor(200, 140, 60);
      pdf.setLineWidth(1);
      pdf.roundedRect(r.x, r.y, r.w, r.h, 4, 4, 'S');
    } else {
      pdf.setFillColor(cr, cg, cb);
      pdf.setDrawColor(180, 180, 180);
      pdf.setLineWidth(0.5);
      pdf.roundedRect(r.x, r.y, r.w, r.h, 4, 4, 'FD');
    }

    // Drill-down indicator
    if (node.childDiagramId) {
      const iconSize = 8;
      const ix = r.x + r.w - iconSize - 3;
      const iy = r.y + 3;
      pdf.saveGraphicsState();
      pdf.setGState(pdf.GState({ opacity: 0.5 }));
      pdf.setFillColor(0, 0, 0);
      pdf.roundedRect(ix, iy, iconSize, iconSize, 1, 1, 'F');
      pdf.restoreGraphicsState();
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(6);
      pdf.text('▶', ix + iconSize / 2, iy + iconSize / 2 + 2, { align: 'center' });
    }

    // Node type label
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(Math.max(6, 7 * scale));
    pdf.setTextColor(255, 255, 255, 0.65);
    const typeY = r.y + r.h * 0.35;
    pdf.text(node.type.toUpperCase(), r.x + r.w / 2, typeY, { align: 'center' });

    // Node main label
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(Math.max(7, 9 * scale));
    pdf.setTextColor(255, 255, 255);
    pdf.text(truncate(node.label, 22), r.x + r.w / 2, r.y + r.h / 2 + 2, {
      align: 'center',
    });

    // Description
    if (node.description) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(Math.max(6, 7 * scale));
      pdf.setTextColor(255, 255, 255, 0.75);
      pdf.text(truncate(node.description, 26), r.x + r.w / 2, r.y + r.h * 0.65, {
        align: 'center',
      });
    }
  }

  return nodeRects;
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
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
