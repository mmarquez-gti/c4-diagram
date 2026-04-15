import LZString from 'lz-string';
import type { C4Project } from './c4/types';

export interface UrlStateSnapshot {
  project: C4Project;
  activeDiagramId?: string;
}

const HASH_PREFIX = 'share=';
const LEGACY_HASH_PREFIX = 'state=';

export function serializeStateToHash(snapshot: UrlStateSnapshot): string {
  const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(snapshot));
  return `#${HASH_PREFIX}${compressed}`;
}

/** Validate and extract a UrlStateSnapshot from a parsed JSON object. */
function validateSnapshot(parsed: Partial<UrlStateSnapshot>): UrlStateSnapshot | null {
  if (!parsed.project || typeof parsed.project !== 'object') return null;
  if (typeof parsed.project.rootDiagramId !== 'string') return null;
  if (!parsed.project.diagrams || typeof parsed.project.diagrams !== 'object') return null;
  if (parsed.activeDiagramId !== undefined && typeof parsed.activeDiagramId !== 'string') return null;
  return {
    project: parsed.project as C4Project,
    activeDiagramId: parsed.activeDiagramId,
  };
}

/**
 * Decode a base64url string (RFC 4648 §5) to a UTF-8 string.
 * Used for the legacy `#state=` URL format.
 */
function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  // Add '=' padding to make the length a multiple of 4
  const remainder = base64.length % 4;
  const padded = remainder === 0 ? base64 : base64 + '='.repeat(4 - remainder);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function deserializeStateFromHash(hash: string): UrlStateSnapshot | null {
  const normalized = hash.startsWith('#') ? hash.slice(1) : hash;

  // Current format: #share=<lz-compressed-json>
  if (normalized.startsWith(HASH_PREFIX)) {
    try {
      const decompressed = LZString.decompressFromEncodedURIComponent(
        normalized.slice(HASH_PREFIX.length),
      );
      if (!decompressed) return null;
      return validateSnapshot(JSON.parse(decompressed) as Partial<UrlStateSnapshot>);
    } catch {
      return null;
    }
  }

  // Legacy format: #state=<base64url-json> (produced by older deployments)
  if (normalized.startsWith(LEGACY_HASH_PREFIX)) {
    try {
      const decoded = decodeBase64Url(normalized.slice(LEGACY_HASH_PREFIX.length));
      return validateSnapshot(JSON.parse(decoded) as Partial<UrlStateSnapshot>);
    } catch {
      return null;
    }
  }

  return null;
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
