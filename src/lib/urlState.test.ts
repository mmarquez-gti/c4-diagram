import { describe, expect, it } from 'vitest';
import { createProject } from './c4/model';
import { deserializeStateFromHash, serializeStateToHash } from './urlState';

describe('urlState', () => {
  it('round-trips a project snapshot through a compressed hash', () => {
    const project = createProject('URL Save Test');
    const hash = serializeStateToHash({
      project,
      activeDiagramId: project.rootDiagramId,
    });

    expect(hash).toMatch(/^#share=/);

    const restored = deserializeStateFromHash(hash);

    expect(restored).not.toBeNull();
    expect(restored?.project.name).toBe('URL Save Test');
    expect(restored?.activeDiagramId).toBe(project.rootDiagramId);
  });

  it('returns null for unrelated hashes', () => {
    expect(deserializeStateFromHash('#foo=bar')).toBeNull();
  });

  it('returns null for invalid payloads', () => {
    expect(deserializeStateFromHash('#share=not-valid-lz-data')).toBeNull();
  });
});