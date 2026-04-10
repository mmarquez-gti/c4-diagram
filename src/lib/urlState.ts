import type { C4Project } from './c4/types';

export interface UrlStateSnapshot {
  project: C4Project;
  activeDiagramId?: string;
}

const HASH_PREFIX = 'state=';

function encodeBase64Url(text: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(text, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4 || 4)) % 4);

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(padded, 'base64').toString('utf8');
  }

  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function serializeStateToHash(snapshot: UrlStateSnapshot): string {
  return `#${HASH_PREFIX}${encodeBase64Url(JSON.stringify(snapshot))}`;
}

export function deserializeStateFromHash(hash: string): UrlStateSnapshot | null {
  const normalized = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!normalized.startsWith(HASH_PREFIX)) return null;

  try {
    const decoded = decodeBase64Url(normalized.slice(HASH_PREFIX.length));
    const parsed = JSON.parse(decoded) as Partial<UrlStateSnapshot>;
    if (!parsed.project || typeof parsed.project !== 'object') return null;
    if (typeof parsed.project.rootDiagramId !== 'string') return null;
    if (!parsed.project.diagrams || typeof parsed.project.diagrams !== 'object') return null;
    if (parsed.activeDiagramId !== undefined && typeof parsed.activeDiagramId !== 'string') return null;
    return {
      project: parsed.project as C4Project,
      activeDiagramId: parsed.activeDiagramId,
    };
  } catch {
    return null;
  }
}

export function getStateFromUrl(): UrlStateSnapshot | null {
  if (typeof window === 'undefined') return null;
  return deserializeStateFromHash(window.location.hash);
}

export function replaceStateInUrl(snapshot: UrlStateSnapshot): void {
  if (typeof window === 'undefined') return;
  const nextHash = serializeStateToHash(snapshot);
  const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
  window.history.replaceState(null, '', nextUrl);
}
