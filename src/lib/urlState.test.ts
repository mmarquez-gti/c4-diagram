import { describe, expect, it } from 'vitest';
import { createProject } from './c4/model';
import { deserializeStateFromHash, serializeStateToHash, type UrlStateSnapshot } from './urlState';

// ---------------------------------------------------------------------------
// Helper: produce a legacy #state=<base64url> hash the same way the old code did
// ---------------------------------------------------------------------------

function encodeBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function makeLegacyHash(snapshot: UrlStateSnapshot): string {
  return `#state=${encodeBase64Url(JSON.stringify(snapshot))}`;
}

// ---------------------------------------------------------------------------

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

  it('decodes a legacy #state=<base64url> hash (backward compatibility)', () => {
    const project = createProject('Legacy Share Test');
    const snapshot: UrlStateSnapshot = { project, activeDiagramId: project.rootDiagramId };
    const hash = makeLegacyHash(snapshot);

    expect(hash).toMatch(/^#state=/);

    const restored = deserializeStateFromHash(hash);

    expect(restored).not.toBeNull();
    expect(restored?.project.name).toBe('Legacy Share Test');
    expect(restored?.activeDiagramId).toBe(project.rootDiagramId);
  });

  it('returns null for a malformed legacy #state= payload', () => {
    expect(deserializeStateFromHash('#state=not-valid-base64url!')).toBeNull();
  });
});