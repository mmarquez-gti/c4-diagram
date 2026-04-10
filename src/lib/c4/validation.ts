import type { C4Project, C4Diagram } from './types';
import { MAX_DEPTH } from './model';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Reference validation
// ---------------------------------------------------------------------------

/**
 * Checks that every edge in every diagram references nodes that exist in
 * that same diagram.
 */
export function validateReferences(project: C4Project): ValidationResult {
  const errors: string[] = [];

  for (const [diagId, diagram] of Object.entries(project.diagrams)) {
    const nodeIds = new Set(diagram.nodes.map((n) => n.id));
    for (const edge of diagram.edges) {
      if (!nodeIds.has(edge.source)) {
        errors.push(
          `Diagram "${diagId}": edge "${edge.id}" has unknown source "${edge.source}"`,
        );
      }
      if (!nodeIds.has(edge.target)) {
        errors.push(
          `Diagram "${diagId}": edge "${edge.id}" has unknown target "${edge.target}"`,
        );
      }
    }

    for (const node of diagram.nodes) {
      if (node.childDiagramId && !project.diagrams[node.childDiagramId]) {
        errors.push(
          `Diagram "${diagId}": node "${node.id}" references missing childDiagram "${node.childDiagramId}"`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Cycle detection in diagram nesting
// ---------------------------------------------------------------------------

/**
 * Returns true if adding an edge from `diagramId` to `childId` would create
 * a cycle in the diagram parent–child graph.
 */
export function wouldCreateCycle(
  project: C4Project,
  diagramId: string,
  childId: string,
): boolean {
  if (diagramId === childId) return true;

  // Build a parent→children adjacency map from existing childDiagramIds
  const children: Record<string, string[]> = {};
  for (const diagram of Object.values(project.diagrams)) {
    for (const node of diagram.nodes) {
      if (node.childDiagramId) {
        if (!children[diagram.id]) children[diagram.id] = [];
        children[diagram.id].push(node.childDiagramId);
      }
    }
  }

  // DFS from childId: if we reach diagramId, it's a cycle
  const visited = new Set<string>();
  const stack = [childId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === diagramId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of children[current] ?? []) {
      stack.push(next);
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Depth validation
// ---------------------------------------------------------------------------

export function validateDepth(diagram: C4Diagram): ValidationResult {
  if (diagram.depth > MAX_DEPTH) {
    return {
      valid: false,
      errors: [
        `Diagram "${diagram.id}" has depth ${diagram.depth} which exceeds the maximum of ${MAX_DEPTH}`,
      ],
    };
  }
  return { valid: true, errors: [] };
}

// ---------------------------------------------------------------------------
// Full project validation
// ---------------------------------------------------------------------------

export function validateProject(project: C4Project): ValidationResult {
  const errors: string[] = [];

  // Root diagram must exist
  if (!project.diagrams[project.rootDiagramId]) {
    errors.push(`Root diagram "${project.rootDiagramId}" does not exist`);
  }

  // Reference checks
  const refResult = validateReferences(project);
  errors.push(...refResult.errors);

  // Depth checks
  for (const diagram of Object.values(project.diagrams)) {
    const depthResult = validateDepth(diagram);
    errors.push(...depthResult.errors);
  }

  return { valid: errors.length === 0, errors };
}
