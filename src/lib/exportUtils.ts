/**
 * Export utilities for the C4 Diagram editor.
 *
 * - exportCurrentLayerToPng: captures the visible ReactFlow canvas as a PNG file.
 * - exportProjectToPdf: generates an interactive multi-page PDF of the whole project.
 *   Each page is produced by temporarily switching the active diagram and capturing
 *   the ReactFlow canvas as a PNG via html-to-image, so the output is pixel-perfect
 *   and always matches the React render.
 *   Nodes with child diagrams have clickable links to their subdiagram page.
 *   Sub-diagram pages include a clickable "↑ Back" annotation that links to the parent.
 */

import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import type { C4Project } from './c4/types';
import { $activeDiagramId, $navigationStack } from '../stores/diagramStore';

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
// PDF export — canvas capture approach
// ---------------------------------------------------------------------------

/** Title bar height at top of each page (pt) */
const TITLE_H = 28;
/** Back-button bounding box (pt) */
const BACK_BTN = { x: 24, y: TITLE_H + 6, w: 72, h: 18 };
/** Pixels per point at standard 96 dpi screen (used for image sizing) */
const PX_PER_PT = 96 / 72;
/**
 * Time (ms) to wait after switching the active diagram before capturing.
 * ReactFlow's FitViewOnDiagramChange component uses a 50 ms timer internally;
 * this value gives two animation frames (~32 ms) plus extra headroom for the
 * fitView animation and any CSS transitions to settle.
 */
const REACTFLOW_SETTLE_DELAY_MS = 150;

// ---------------------------------------------------------------------------
// ReactFlow viewport helper
// ---------------------------------------------------------------------------

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Reads the current ReactFlow viewport transform from the DOM.
 * ReactFlow sets `transform: translate(Xpx, Ypx) scale(Z)` on the viewport
 * element (.react-flow__viewport).  This is an internal implementation detail
 * of @xyflow/react and may change across major versions; if parsing fails the
 * function returns null and callers fall back to skipping drill-down links.
 * Returns null if the element is not found or the transform cannot be parsed.
 */
function readReactFlowViewport(container: HTMLElement): Viewport | null {
  const el = container.querySelector<HTMLElement>('.react-flow__viewport');
  if (!el) return null;
  const transform = el.style.transform;
  // Expected format (as of @xyflow/react v12): "translate(Xpx, Ypx) scale(Z)"
  const match = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+)\)/);
  if (!match) return null;
  return {
    x: parseFloat(match[1]),
    y: parseFloat(match[2]),
    zoom: parseFloat(match[3]),
  };
}

// ---------------------------------------------------------------------------
// BFS traversal helper
// ---------------------------------------------------------------------------

interface DiagramEntry {
  diagramId: string;
  parentDiagramId: string | null;
}

function bfsOrder(project: C4Project): DiagramEntry[] {
  const result: DiagramEntry[] = [];
  const queue: DiagramEntry[] = [{ diagramId: project.rootDiagramId, parentDiagramId: null }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const entry = queue.shift()!;
    if (visited.has(entry.diagramId)) continue;
    visited.add(entry.diagramId);

    const diagram = project.diagrams[entry.diagramId];
    if (!diagram) continue;

    result.push(entry);

    for (const node of diagram.nodes) {
      if (node.childDiagramId && project.diagrams[node.childDiagramId]) {
        queue.push({ diagramId: node.childDiagramId, parentDiagramId: entry.diagramId });
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Capture helper
// ---------------------------------------------------------------------------

interface CapturedPage {
  diagramId: string;
  title: string;
  dataUrl: string;
  /** CSS-pixel width of the canvas container at capture time */
  containerWidth: number;
  /** CSS-pixel height of the canvas container at capture time */
  containerHeight: number;
  /** ReactFlow viewport transform at capture time (null if unreadable) */
  viewport: Viewport | null;
}

/**
 * Hides ReactFlow UI chrome (controls, minimap, attribution) in `container`,
 * captures a PNG data URL, then restores visibility.
 */
async function captureCanvasPng(container: HTMLElement): Promise<string> {
  const controls = container.querySelectorAll<HTMLElement>(
    '.react-flow__controls, .react-flow__minimap, .react-flow__attribution',
  );
  controls.forEach((el) => (el.style.visibility = 'hidden'));
  try {
    return await toPng(container, {
      backgroundColor: '#030712',
      pixelRatio: 2,
    });
  } finally {
    controls.forEach((el) => (el.style.visibility = ''));
  }
}

// ---------------------------------------------------------------------------
// Public PDF export function
// ---------------------------------------------------------------------------

/**
 * Generates an interactive multi-page PDF of the whole project.
 *
 * For each diagram the function temporarily switches the active diagram,
 * waits for ReactFlow to re-render and fit the view, then captures the canvas
 * as a PNG via html-to-image.  The PNG is embedded verbatim in the PDF page so
 * the output is pixel-perfect and always matches what the React canvas shows.
 *
 * Interactive features:
 * - Each page has a dark title bar with the diagram name.
 * - Sub-diagram pages have a "↑ Back" button that links to the parent page.
 * - Nodes that have a child diagram are clickable and navigate to that page.
 *
 * @param project   The C4 project to export.
 * @param filename  Base filename without extension.
 */
export async function exportProjectToPdf(project: C4Project, filename: string): Promise<void> {
  const ordered = bfsOrder(project);
  if (ordered.length === 0) return;

  const container = document.getElementById('diagram-canvas-container');
  if (!container) throw new Error('Canvas container element not found.');

  // Save state we will temporarily mutate
  const savedActiveDiagramId = $activeDiagramId.get();
  const savedNavigationStack = $navigationStack.get();

  const capturedPages: CapturedPage[] = [];

  try {
    for (const { diagramId } of ordered) {
      const diagram = project.diagrams[diagramId];
      if (!diagram) continue;

      // Switch active diagram directly on the atom rather than through
      // jumpToDiagram / navigateTo so that the navigation breadcrumb stack
      // and history are not modified.  We restore both atoms unconditionally
      // in the finally block, so the user's original view is always recovered.
      $activeDiagramId.set(diagramId);

      // Give ReactFlow two animation frames + extra headroom for the internal
      // 50 ms fitView timer (FitViewOnDiagramChange) to settle before capture.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(resolve, REACTFLOW_SETTLE_DELAY_MS);
          });
        });
      });

      const rect = container.getBoundingClientRect();
      const viewport = readReactFlowViewport(container);
      const dataUrl = await captureCanvasPng(container);

      capturedPages.push({
        diagramId,
        title: diagram.title,
        dataUrl,
        containerWidth: rect.width,
        containerHeight: rect.height,
        viewport,
      });
    }
  } finally {
    // Restore original diagram unconditionally
    $activeDiagramId.set(savedActiveDiagramId);
    $navigationStack.set(savedNavigationStack);
  }

  if (capturedPages.length === 0) return;

  // -------------------------------------------------------------------------
  // Build lookup tables
  // -------------------------------------------------------------------------

  const pageOf: Record<string, number> = {};
  ordered.forEach(({ diagramId }, i) => { pageOf[diagramId] = i + 1; });

  const parentOf: Record<string, string> = {};
  ordered.forEach(({ diagramId, parentDiagramId }) => {
    if (parentDiagramId) parentOf[diagramId] = parentDiagramId;
  });

  // -------------------------------------------------------------------------
  // Construct PDF
  // -------------------------------------------------------------------------

  // Each PDF page width equals the canvas CSS-pixel width converted to pt.
  // Height = canvas height (pt) + title bar.
  const firstPage = capturedPages[0];
  const firstPageW = firstPage.containerWidth / PX_PER_PT;
  const firstPageH = firstPage.containerHeight / PX_PER_PT + TITLE_H;

  const pdf = new jsPDF({
    orientation: firstPageW >= firstPageH ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [firstPageW, firstPageH],
  });

  for (let i = 0; i < capturedPages.length; i++) {
    const page = capturedPages[i];
    const isRoot = page.diagramId === project.rootDiagramId;

    const pageW = page.containerWidth / PX_PER_PT;
    const pageH = page.containerHeight / PX_PER_PT + TITLE_H;
    const imgY = TITLE_H;
    const imgH = page.containerHeight / PX_PER_PT;

    if (i > 0) {
      pdf.addPage([pageW, pageH], pageW >= pageH ? 'landscape' : 'portrait');
    }

    // ---- Dark title bar ----
    pdf.setFillColor(12, 15, 26);
    pdf.rect(0, 0, pageW, TITLE_H, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(139, 154, 176);
    pdf.text(page.title, 24, TITLE_H - 8);

    // ---- Back button (non-root pages) ----
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

    // ---- Embedded canvas PNG ----
    pdf.addImage(page.dataUrl, 'PNG', 0, imgY, pageW, imgH);
  }

  // -------------------------------------------------------------------------
  // Interactive links (added after all pages are drawn)
  // -------------------------------------------------------------------------

  for (let i = 0; i < capturedPages.length; i++) {
    const page = capturedPages[i];
    const isRoot = page.diagramId === project.rootDiagramId;
    pdf.setPage(i + 1);

    const pageW = page.containerWidth / PX_PER_PT;
    const imgH = page.containerHeight / PX_PER_PT;

    // ---- Back button link ----
    if (!isRoot && parentOf[page.diagramId]) {
      const parentPage = pageOf[parentOf[page.diagramId]];
      if (parentPage !== undefined) {
        const { x: bx, y: by, w: bw, h: bh } = BACK_BTN;
        pdf.link(bx, by, bw, bh, { pageNumber: parentPage });
      }
    }

    // ---- Drill-down node links ----
    const diagram = project.diagrams[page.diagramId];
    if (!diagram) continue;

    const vp = page.viewport;
    if (vp) {
      // Map diagram coordinates → screen pixels → PDF points
      const scaleX = pageW / page.containerWidth;
      const scaleY = imgH / page.containerHeight;

      for (const node of diagram.nodes) {
        if (!node.childDiagramId) continue;
        const targetPage = pageOf[node.childDiagramId];
        if (targetPage === undefined) continue;

        // Diagram-space → screen-pixel (CSS px)
        const screenX = node.position.x * vp.zoom + vp.x;
        const screenY = node.position.y * vp.zoom + vp.y;
        const screenW = node.size.width * vp.zoom;
        const screenH = node.size.height * vp.zoom;

        // Screen-pixel → PDF point (offset by title bar)
        const lx = screenX * scaleX;
        const ly = TITLE_H + screenY * scaleY;
        const lw = screenW * scaleX;
        const lh = screenH * scaleY;

        pdf.link(lx, ly, lw, lh, { pageNumber: targetPage });
      }
    }
  }

  pdf.save(`${filename}.pdf`);
}
