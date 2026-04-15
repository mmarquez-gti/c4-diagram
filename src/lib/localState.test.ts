import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { saveToLocalStorage, loadFromLocalStorage } from './localState';
import { createProject, createNode, createEdge, addNodeToProject, addEdgeToProject } from './c4/model';

// ---------------------------------------------------------------------------
// localStorage mock (the test environment is Node, which has no localStorage)
// ---------------------------------------------------------------------------

function makeLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    _getStore: () => store,
  };
}

let localStorageMock: ReturnType<typeof makeLocalStorageMock>;

beforeEach(() => {
  localStorageMock = makeLocalStorageMock();
  vi.stubGlobal('localStorage', localStorageMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// saveToLocalStorage
// ---------------------------------------------------------------------------

describe('saveToLocalStorage', () => {
  it('persists a snapshot with a project and activeDiagramId', () => {
    const project = createProject('Save Test');
    saveToLocalStorage({ project, activeDiagramId: project.rootDiagramId });

    expect(localStorageMock.setItem).toHaveBeenCalledOnce();
    const raw = localStorageMock._getStore()['c4-diagram-autosave'];
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw);
    expect(parsed.project.name).toBe('Save Test');
    expect(parsed.activeDiagramId).toBe(project.rootDiagramId);
  });

  it('persists a snapshot without activeDiagramId', () => {
    const project = createProject('No Active');
    saveToLocalStorage({ project });

    const raw = localStorageMock._getStore()['c4-diagram-autosave'];
    const parsed = JSON.parse(raw);
    expect(parsed.project.name).toBe('No Active');
    expect(parsed.activeDiagramId).toBeUndefined();
  });

  it('persists a project with nodes and edges', () => {
    let project = createProject('Rich Project');
    const node1 = createNode({ type: 'Person', label: 'User' });
    const node2 = createNode({ type: 'System', label: 'Backend' });
    project = addNodeToProject(project, project.rootDiagramId, node1);
    project = addNodeToProject(project, project.rootDiagramId, node2);
    const edge = createEdge({ source: node1.id, target: node2.id, label: 'Uses' });
    project = addEdgeToProject(project, project.rootDiagramId, edge);

    saveToLocalStorage({ project, activeDiagramId: project.rootDiagramId });

    const raw = localStorageMock._getStore()['c4-diagram-autosave'];
    const parsed = JSON.parse(raw);
    expect(parsed.project.diagrams[project.rootDiagramId].nodes).toHaveLength(2);
    expect(parsed.project.diagrams[project.rootDiagramId].edges).toHaveLength(1);
    expect(parsed.project.diagrams[project.rootDiagramId].edges[0].label).toBe('Uses');
  });

  it('silently ignores localStorage errors (e.g. quota exceeded)', () => {
    localStorageMock.setItem.mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    const project = createProject();
    // Should not throw
    expect(() => saveToLocalStorage({ project })).not.toThrow();
  });

  it('does nothing when localStorage is undefined', () => {
    vi.stubGlobal('localStorage', undefined);
    const project = createProject();
    expect(() => saveToLocalStorage({ project })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// loadFromLocalStorage
// ---------------------------------------------------------------------------

describe('loadFromLocalStorage', () => {
  it('returns null when nothing has been saved', () => {
    expect(loadFromLocalStorage()).toBeNull();
  });

  it('round-trips a simple snapshot', () => {
    const project = createProject('Round Trip');
    saveToLocalStorage({ project, activeDiagramId: project.rootDiagramId });

    const result = loadFromLocalStorage();
    expect(result).not.toBeNull();
    expect(result!.project.name).toBe('Round Trip');
    expect(result!.activeDiagramId).toBe(project.rootDiagramId);
  });

  it('round-trips a project with nodes and edges', () => {
    let project = createProject('Complex');
    const n1 = createNode({ type: 'Person', label: 'Alice' });
    const n2 = createNode({ type: 'Container', label: 'API' });
    project = addNodeToProject(project, project.rootDiagramId, n1);
    project = addNodeToProject(project, project.rootDiagramId, n2);
    const edge = createEdge({ source: n1.id, target: n2.id, label: 'Calls', technology: 'HTTP' });
    project = addEdgeToProject(project, project.rootDiagramId, edge);

    saveToLocalStorage({ project, activeDiagramId: project.rootDiagramId });

    const result = loadFromLocalStorage();
    expect(result).not.toBeNull();
    const diag = result!.project.diagrams[project.rootDiagramId];
    expect(diag.nodes).toHaveLength(2);
    expect(diag.nodes[0].label).toBe('Alice');
    expect(diag.edges[0].technology).toBe('HTTP');
  });

  it('loads a snapshot where activeDiagramId is absent', () => {
    const project = createProject('No Active');
    saveToLocalStorage({ project });

    const result = loadFromLocalStorage();
    expect(result).not.toBeNull();
    expect(result!.activeDiagramId).toBeUndefined();
  });

  it('returns null for stored invalid JSON', () => {
    localStorageMock.setItem.mockImplementation((key: string) => {
      localStorageMock._getStore()[key] = 'not-valid-json{{{';
    });
    saveToLocalStorage({ project: createProject() });
    expect(loadFromLocalStorage()).toBeNull();
  });

  it('returns null when stored object has no project field', () => {
    localStorageMock.setItem.mockImplementation((key: string) => {
      localStorageMock._getStore()[key] = JSON.stringify({ activeDiagramId: 'abc' });
    });
    saveToLocalStorage({ project: createProject() });
    expect(loadFromLocalStorage()).toBeNull();
  });

  it('returns null when project.rootDiagramId is not a string', () => {
    localStorageMock.setItem.mockImplementation((key: string) => {
      localStorageMock._getStore()[key] = JSON.stringify({
        project: { rootDiagramId: 42, diagrams: {} },
      });
    });
    saveToLocalStorage({ project: createProject() });
    expect(loadFromLocalStorage()).toBeNull();
  });

  it('returns null when project.diagrams is missing', () => {
    localStorageMock.setItem.mockImplementation((key: string) => {
      localStorageMock._getStore()[key] = JSON.stringify({
        project: { rootDiagramId: 'root', name: 'Bad' },
      });
    });
    saveToLocalStorage({ project: createProject() });
    expect(loadFromLocalStorage()).toBeNull();
  });

  it('ignores a non-string activeDiagramId in the stored payload', () => {
    const project = createProject('Test');
    const raw = JSON.stringify({ project, activeDiagramId: 999 });
    localStorageMock.getItem.mockReturnValue(raw);

    const result = loadFromLocalStorage();
    // Should still load the project but without the invalid activeDiagramId
    expect(result).not.toBeNull();
    expect(result!.activeDiagramId).toBeUndefined();
  });

  it('returns null when localStorage is undefined', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(loadFromLocalStorage()).toBeNull();
  });
});
