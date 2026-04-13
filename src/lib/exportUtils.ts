/**
 * Export utilities for the C4 Diagram editor.
 *
 * - exportCurrentLayerToPng: captures the visible ReactFlow canvas as a PNG file.
 * - exportProjectToPdf: generates an interactive PDF where each diagram is a page.
 *   Each page is a pixel-perfect screenshot of the ReactFlow canvas, captured by
 *   navigating to each diagram in turn and rendering it with html-to-image.
 *   Nodes with child diagrams have clickable links to their subdiagram page.
 *   Sub-diagram pages include a clickable "↑ Back" annotation that links to the parent.
 */

import { toPng } from 'html-to-image';
import { getViewportForBounds } from '@xyflow/react';
import { jsPDF } from 'jspdf';
import type { C4Diagram, C4Node, C4Project } from './c4/types';
import { $activeDiagramId, jumpToDiagram } from '../stores/diagramStore';

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
// Interactive PDF export
// ---------------------------------------------------------------------------

/** A4 dimensions in pt */
const PAGE_W = 595;
const PAGE_H = 842;
/** Left/right margin (pt) for title text and back button */
const PDF_MARGIN = 32;
/** Title bar height (pt) drawn with jsPDF at the top of each page */
const TITLE_H = 28;
/** Content area top offset — where the screenshot begins */
const CONTENT_TOP = TITLE_H;
/** Content area height */
const CONTENT_H = PAGE_H - CONTENT_TOP;
/** Back-button bounding box (pt) — positioned inside the content area below the title bar */
const BACK_BTN = { x: PDF_MARGIN, y: CONTENT_TOP + 8, w: 72, h: 18 };
/** Screenshot image dimensions (2× A4 content area for crisp rendering) */
const PDF_IMG_W = PAGE_W * 2;     // 1190 px
const PDF_IMG_H = CONTENT_H * 2;  // 1628 px

// ---------------------------------------------------------------------------
// Screenshot capture helpers
// ---------------------------------------------------------------------------

/** Milliseconds to wait after a diagram switch for React and ReactFlow to finish rendering. */
const RENDER_SETTLE_MS = 100;

/** Pause until React has committed DOM updates and the browser has painted. */
function waitForReactRender(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(resolve, RENDER_SETTLE_MS);
      });
    });
  });
}

/** Compute the axis-aligned bounding box of all C4 nodes. */
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

type ViewportTransform = { x: number; y: number; zoom: number };

/**
 * Capture the ReactFlow viewport as a PNG data URL.
 *
 * Applies a computed transform (via getViewportForBounds) so that all nodes in
 * the diagram fit within the image, regardless of the current pan/zoom state.
 * Returns both the data URL and the viewport transform used, so callers can
 * map canvas-space node coordinates back to PDF-page coordinates.
 */
async function captureViewportAsImage(
  nodes: C4Node[],
): Promise<{ dataUrl: string; viewport: ViewportTransform }> {
  const viewportEl = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewportEl) throw new Error('.react-flow__viewport element not found');

  const bounds = computeNodeBounds(nodes);
  let vp: ViewportTransform;

  if (bounds) {
    vp = getViewportForBounds(bounds, PDF_IMG_W, PDF_IMG_H, 0.05, 2, 0.1);
  } else {
    vp = { x: 0, y: 0, zoom: 1 };
  }

  const dataUrl = await toPng(viewportEl, {
    backgroundColor: '#030712',
    width: PDF_IMG_W,
    height: PDF_IMG_H,
    style: {
      width: `${PDF_IMG_W}px`,
      height: `${PDF_IMG_H}px`,
      transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
    },
  });

  return { dataUrl, viewport: vp };
}

/**
 * Compute a node's bounding rect in PDF page coordinates given the viewport
 * transform that was used when capturing the screenshot.
 *
 * The screenshot covers the content area below the title bar (CONTENT_TOP to
 * PAGE_H) at PDF_IMG_W × PDF_IMG_H pixel resolution.  Scaling:
 *   scaleX = PAGE_W  / PDF_IMG_W  = 0.5
 *   scaleY = CONTENT_H / PDF_IMG_H = 0.5
 */
function nodeRectInPdf(
  node: C4Node,
  vp: ViewportTransform,
): { x: number; y: number; w: number; h: number } {
  const scaleX = PAGE_W / PDF_IMG_W;
  const scaleY = CONTENT_H / PDF_IMG_H;
  return {
    x: (node.position.x * vp.zoom + vp.x) * scaleX,
    y: CONTENT_TOP + (node.position.y * vp.zoom + vp.y) * scaleY,
    w: node.size.width * vp.zoom * scaleX,
    h: node.size.height * vp.zoom * scaleY,
  };
}

// ---------------------------------------------------------------------------
// BFS traversal helper
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

// ---------------------------------------------------------------------------
// Public PDF export function
// ---------------------------------------------------------------------------

/**
 * Generates an interactive multi-page PDF of the whole project.
 *
 * Each page is a pixel-perfect screenshot of the ReactFlow canvas, captured
 * by navigating to each diagram in turn.  After all screenshots are taken the
 * original active diagram is restored, and interactive links (drill-down nodes
 * and "↑ Back" buttons) are layered on top of the images.
 *
 * - One page per diagram (BFS order).
 * - Nodes with a child diagram have a clickable region that links to the
 *   corresponding sub-diagram page.
 * - Sub-diagram pages include a clickable "↑ Back" link to their parent page.
 */
export async function exportProjectToPdf(project: C4Project, filename: string): Promise<void> {
  const ordered = bfsOrder(project);
  if (ordered.length === 0) return;

  const originalDiagramId = $activeDiagramId.get();

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

  // Store the viewport transform used for each page so we can compute link rects
  const pageViewports: ViewportTransform[] = [];

  for (let i = 0; i < ordered.length; i++) {
    const { diagram } = ordered[i];
    if (i > 0) pdf.addPage();

    // Navigate to this diagram and wait for ReactFlow to render its nodes
    jumpToDiagram(diagram.id);
    await waitForReactRender();

    // Capture the ReactFlow viewport as a screenshot
    const { dataUrl, viewport } = await captureViewportAsImage(diagram.nodes);
    pageViewports.push(viewport);

    // ----- Background -----
    pdf.setFillColor(3, 7, 18); // gray-950
    pdf.rect(0, 0, PAGE_W, PAGE_H, 'F');

    // ----- Screenshot (content area below title bar) -----
    pdf.addImage(dataUrl, 'PNG', 0, CONTENT_TOP, PAGE_W, CONTENT_H);

    // ----- Title bar -----
    pdf.setFillColor(12, 15, 26);
    pdf.rect(0, 0, PAGE_W, TITLE_H, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(139, 154, 176);
    pdf.text(diagram.title, PDF_MARGIN, TITLE_H - 8);

    // ----- Back button (visual only — link added below) -----
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
  }

  // Restore the diagram the user was viewing before the export
  jumpToDiagram(originalDiagramId ?? project.rootDiagramId);

  // ----- Interactive links (added after all pages are built) -----
  for (let i = 0; i < ordered.length; i++) {
    const { diagram } = ordered[i];
    pdf.setPage(i + 1);
    const vp = pageViewports[i];

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
      const r = nodeRectInPdf(node, vp);
      pdf.link(r.x, r.y, r.w, r.h, { pageNumber: targetPage });
    }
  }

  pdf.save(`${filename}.pdf`);
}

