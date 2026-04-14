import LZString from 'lz-string';
import type { C4Project } from './c4/types';

export interface UrlStateSnapshot {
  project: C4Project;
  activeDiagramId?: string;
}

const HASH_PREFIX = 'share=';

export function serializeStateToHash(snapshot: UrlStateSnapshot): string {
  const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(snapshot));
  return `#${HASH_PREFIX}${compressed}`;
}

export function deserializeStateFromHash(hash: string): UrlStateSnapshot | null {
  const normalized = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!normalized.startsWith(HASH_PREFIX)) return null;

  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(
      normalized.slice(HASH_PREFIX.length),
    );
    if (!decompressed) return null;
    const parsed = JSON.parse(decompressed) as Partial<UrlStateSnapshot>;
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

export function clearStateFromUrl(): void {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
}

export function buildShareUrl(snapshot: UrlStateSnapshot): string {
  if (typeof window === 'undefined') return '';
  const hash = serializeStateToHash(snapshot);
  return `${window.location.origin}${window.location.pathname}${hash}`;
}
