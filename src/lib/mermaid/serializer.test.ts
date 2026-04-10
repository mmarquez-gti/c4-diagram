import { describe, it, expect } from 'vitest';
import type { C4Diagram, C4Project } from '../c4/types';
import { serializeDiagram, serializeProject, MAX_DEPTH } from './serializer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDiagram(overrides: Partial<C4Diagram> = {}): C4Diagram {
  return {
    id: 'diag-1',
    level: 'context',
    depth: 0,
    title: 'System Context',
    nodes: [],
    edges: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// serializeDiagram
// ---------------------------------------------------------------------------

describe('serializeDiagram', () => {
  it('produces the correct header for each C4 level', () => {
    const levels = ['context', 'container', 'component', 'code'] as const;
    for (const level of levels) {
      const result = serializeDiagram(makeDiagram({ level }));
      expect(result).toMatch(new RegExp(`^C4${level.charAt(0).toUpperCase()}${level.slice(1)}`));
    }
  });

  it('includes the diagram title', () => {
    const result = serializeDiagram(makeDiagram({ title: 'My Title' }));
    expect(result).toContain('title My Title');
  });

  it('serialises a Person node without optional fields', () => {
    const result = serializeDiagram(
      makeDiagram({
        nodes: [
          {
            id: 'user',
            type: 'Person',
            label: 'End User',
            position: { x: 0, y: 0 },
            size: { width: 120, height: 80 },
          },
        ],
      }),
    );
    expect(result).toContain('Person(user, "End User")');
  });

  it('serialises a System node with description and technology', () => {
    const result = serializeDiagram(
      makeDiagram({
        nodes: [
          {
            id: 'api',
            type: 'System',
            label: 'Backend API',
            description: 'Handles requests',
            technology: 'Node.js',
            position: { x: 0, y: 0 },
            size: { width: 120, height: 80 },
          },
        ],
      }),
    );
    expect(result).toContain('System(api, "Backend API", "Handles requests", "Node.js")');
  });

  it('serialises an edge without optional fields', () => {
    const result = serializeDiagram(
      makeDiagram({
        edges: [{ id: 'e1', source: 'user', target: 'api' }],
      }),
    );
    expect(result).toContain('Rel(user, api)');
  });

  it('serialises an edge with label and technology', () => {
    const result = serializeDiagram(
      makeDiagram({
        edges: [{ id: 'e1', source: 'user', target: 'api', label: 'Calls', technology: 'HTTPS' }],
      }),
    );
    expect(result).toContain('Rel(user, api, "Calls", "HTTPS")');
  });

  it('includes all nodes and edges', () => {
    const result = serializeDiagram(
      makeDiagram({
        nodes: [
          { id: 'n1', type: 'Person', label: 'User', position: { x: 0, y: 0 }, size: { width: 120, height: 80 } },
          { id: 'n2', type: 'System', label: 'App', position: { x: 0, y: 0 }, size: { width: 120, height: 80 } },
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', label: 'Uses' },
        ],
      }),
    );
    expect(result).toContain('Person(n1, "User")');
    expect(result).toContain('System(n2, "App")');
    expect(result).toContain('Rel(n1, n2, "Uses")');
  });
});

// ---------------------------------------------------------------------------
// serializeProject
// ---------------------------------------------------------------------------

describe('serializeProject', () => {
  it('serialises a project with a single root diagram', () => {
    const diagram = makeDiagram();
    const diagrams: C4Project['diagrams'] = { [diagram.id]: diagram };
    const result = serializeProject(diagrams, diagram.id);
    expect(result).toContain('C4Context');
    expect(result).toContain('title System Context');
  });

  it('returns empty string for an unknown root id', () => {
    expect(serializeProject({}, 'nonexistent')).toBe('');
  });

  it('nests a child diagram inside the parent output', () => {
    const child = makeDiagram({
      id: 'child-1',
      level: 'container',
      depth: 1,
      title: 'Container Diagram',
    });
    const parent = makeDiagram({
      nodes: [
        {
          id: 'sys',
          type: 'System',
          label: 'My System',
          position: { x: 0, y: 0 },
          size: { width: 120, height: 80 },
          childDiagramId: 'child-1',
        },
      ],
    });
    const diagrams = { [parent.id]: parent, [child.id]: child };
    const result = serializeProject(diagrams, parent.id);
    expect(result).toContain('%% [SUBSYSTEM:sys]');
    expect(result).toContain('C4Container');
    expect(result).toContain('title Container Diagram');
    expect(result).toContain('%% [/SUBSYSTEM:sys]');
  });

  it('does not recurse beyond MAX_DEPTH', () => {
    // Build a chain of MAX_DEPTH + 2 diagrams
    const diagrams: C4Project['diagrams'] = {};
    const total = MAX_DEPTH + 2;
    for (let i = 0; i < total; i++) {
      const id = `diag-${i}`;
      const childId = i + 1 < total ? `diag-${i + 1}` : undefined;
      diagrams[id] = makeDiagram({
        id,
        depth: i,
        title: `Diagram ${i}`,
        nodes: childId
          ? [
              {
                id: `node-${i}`,
                type: 'System',
                label: `System ${i}`,
                position: { x: 0, y: 0 },
                size: { width: 120, height: 80 },
                childDiagramId: childId,
              },
            ]
          : [],
      });
    }

    const result = serializeProject(diagrams, 'diag-0');

    // Diagram at depth MAX_DEPTH (diag-10) should appear
    expect(result).toContain(`title Diagram ${MAX_DEPTH}`);
    // Diagram beyond MAX_DEPTH (diag-11) should NOT appear
    expect(result).not.toContain(`title Diagram ${MAX_DEPTH + 1}`);
  });

  it('skips child diagrams that do not exist in the record', () => {
    const parent = makeDiagram({
      nodes: [
        {
          id: 'sys',
          type: 'System',
          label: 'Ghost',
          position: { x: 0, y: 0 },
          size: { width: 120, height: 80 },
          childDiagramId: 'does-not-exist',
        },
      ],
    });
    const diagrams = { [parent.id]: parent };
    const result = serializeProject(diagrams, parent.id);
    // No SUBSYSTEM markers when child is missing
    expect(result).not.toContain('[SUBSYSTEM:');
  });
});
