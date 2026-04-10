import { describe, it, expect } from 'vitest';
import { encodeState, decodeState, computeHash } from './urlState';
import type { UrlState } from './urlState';

const sampleProject = {
  id: 'proj-1',
  name: 'Test Project',
  rootDiagramId: 'diag-1',
  diagrams: {
    'diag-1': {
      id: 'diag-1',
      level: 'context' as const,
      depth: 0,
      title: 'Root',
      nodes: [],
      edges: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  },
  version: '1',
};

const sampleState: UrlState = {
  project: sampleProject,
  navigationStack: ['diag-1'],
};

describe('encodeState / decodeState', () => {
  it('roundtrips a state object without data loss', () => {
    const encoded = encodeState(sampleState);
    const decoded = decodeState(encoded);
    expect(decoded).toEqual(sampleState);
  });

  it('produces a URL-safe string (no +, /, or = characters)', () => {
    const encoded = encodeState(sampleState);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });

  it('returns null for clearly invalid input', () => {
    expect(decodeState('!!!not-base64!!!')).toBeNull();
  });

  it('returns null when decoded JSON does not have the expected shape', () => {
    // Valid base64url of "{}" — no project or navigationStack fields
    const encoded = encodeState({ project: sampleProject, navigationStack: ['diag-1'] });
    // Corrupt it to a plain object without required fields
    const broken = btoa('{}').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    expect(decodeState(broken)).toBeNull();
  });

  it('handles unicode characters in project name', () => {
    const state: UrlState = {
      ...sampleState,
      project: { ...sampleProject, name: 'Proyecto de prueba 🚀' },
    };
    const encoded = encodeState(state);
    const decoded = decodeState(encoded);
    expect(decoded?.project.name).toBe('Proyecto de prueba 🚀');
  });

  it('preserves a multi-level navigation stack', () => {
    const state: UrlState = {
      ...sampleState,
      navigationStack: ['diag-1', 'diag-2', 'diag-3'],
    };
    const encoded = encodeState(state);
    const decoded = decodeState(encoded);
    expect(decoded?.navigationStack).toEqual(['diag-1', 'diag-2', 'diag-3']);
  });
});

describe('computeHash', () => {
  it('returns an 8-character lowercase hex string', () => {
    const hash = computeHash('test-input');
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('produces different hashes for different inputs', () => {
    expect(computeHash('state-a')).not.toBe(computeHash('state-b'));
  });

  it('is deterministic — same input always yields the same hash', () => {
    const encoded = encodeState(sampleState);
    expect(computeHash(encoded)).toBe(computeHash(encoded));
  });

  it('handles an empty string without throwing', () => {
    expect(() => computeHash('')).not.toThrow();
    expect(computeHash('')).toMatch(/^[0-9a-f]{8}$/);
  });
});
