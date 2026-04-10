import type { C4Diagram, C4Node, C4Edge, C4Project } from '../c4/types';

/** Maximum supported nesting depth for serialisation */
export const MAX_DEPTH = 10;

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function serializeNode(node: C4Node): string {
  const desc = node.description ? `, "${node.description}"` : '';
  const tech = node.technology ? `, "${node.technology}"` : '';
  return `  ${node.type}(${node.id}, "${node.label}"${desc}${tech})`;
}

function serializeEdge(edge: C4Edge): string {
  const label = edge.label ? `, "${edge.label}"` : '';
  const tech = edge.technology ? `, "${edge.technology}"` : '';
  return `  Rel(${edge.source}, ${edge.target}${label}${tech})`;
}

/**
 * Serialise a single C4Diagram to a Mermaid C4 diagram string.
 */
export function serializeDiagram(diagram: C4Diagram): string {
  const lines: string[] = [
    `C4${capitalize(diagram.level)}`,
    `  title ${diagram.title}`,
  ];

  for (const node of diagram.nodes) {
    lines.push(serializeNode(node));
  }
  for (const edge of diagram.edges) {
    lines.push(serializeEdge(edge));
  }

  return lines.join('\n');
}

/**
 * Serialise an entire C4Project as nested Mermaid blocks.
 * Recursion is limited to MAX_DEPTH (10) levels.
 *
 * @param diagrams  - flat record of all diagrams in the project
 * @param rootId    - id of the diagram to start from
 * @param depth     - current recursion depth (default 0)
 */
export function serializeProject(
  diagrams: Record<string, C4Diagram>,
  rootId: string,
  depth = 0,
): string {
  if (depth > MAX_DEPTH) return '';

  const diagram = diagrams[rootId];
  if (!diagram) return '';

  let output = serializeDiagram(diagram);

  for (const node of diagram.nodes) {
    if (node.childDiagramId && diagrams[node.childDiagramId]) {
      const child = serializeProject(diagrams, node.childDiagramId, depth + 1);
      if (child) {
        output +=
          `\n\n%% [SUBSYSTEM:${node.id}]\n` +
          child +
          `\n%% [/SUBSYSTEM:${node.id}]`;
      }
    }
  }

  return output;
}
