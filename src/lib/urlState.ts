import type { C4Project } from './c4/types';

export interface UrlState {
  project: C4Project;
  navigationStack: string[];
}

/**
 * Encode a URL state (project + navigation stack) as a URL-safe base64 string
 * (base64url, RFC 4648 §5, no padding).
 */
export function encodeState(state: UrlState): string {
  const json = JSON.stringify(state);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Decode a URL-safe base64 string back to a URL state.
 * Returns null if the string is invalid or does not contain the expected shape.
 */
export function decodeState(encoded: string): UrlState | null {
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (b64.length % 4)) % 4;
    const binary = atob(b64 + '='.repeat(padding));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.project || !Array.isArray(parsed.navigationStack)) return null;
    return parsed as UrlState;
  } catch {
    return null;
  }
}

/**
 * Compute a short FNV-1a 32-bit hash of the encoded state string.
 *
 * This hash is used as a fast identity token stored in history.state so the
 * browser can recognise our entries. It is derived purely from the URL content
 * and therefore never needs to be persisted in a file — the web can recalculate
 * it at any time.
 */
export function computeHash(encoded: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < encoded.length; i++) {
    h = (Math.imul(h ^ encoded.charCodeAt(i), 0x01000193)) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Read and decode the URL state from window.location.hash.
 * Returns null when there is no encoded state in the hash.
 */
export function getStateFromUrl(): UrlState | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash || hash.length <= 1) return null;
  return decodeState(hash.slice(1));
}

/**
 * Push a new browser history entry whose URL hash contains the encoded state.
 * Pressing the browser Back button after this will restore the previous state.
 */
export function pushStateToUrl(state: UrlState): void {
  const encoded = encodeState(state);
  window.history.pushState({ stateHash: computeHash(encoded) }, '', '#' + encoded);
}

/**
 * Replace the current browser history entry's URL hash with the encoded state.
 * Unlike pushStateToUrl this does not create a new history entry.
 */
export function replaceStateInUrl(state: UrlState): void {
  const encoded = encodeState(state);
  window.history.replaceState({ stateHash: computeHash(encoded) }, '', '#' + encoded);
}
