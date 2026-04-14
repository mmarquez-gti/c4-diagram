import { atom } from 'nanostores';

/** Whether the left Diagrams panel is visible */
export const $leftPanelOpen = atom<boolean>(true);

/** Whether the right Properties panel is visible */
export const $rightPanelOpen = atom<boolean>(true);

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

const DARK_MODE_KEY = 'c4:darkMode';

function readDarkModePreference(): boolean {
  try {
    const stored = localStorage.getItem(DARK_MODE_KEY);
    return stored === null ? true : stored !== 'false';
  } catch {
    return true;
  }
}

/** Whether the app is in dark mode (true = dark, false = light). Persisted to localStorage. */
export const $darkMode = atom<boolean>(readDarkModePreference());

$darkMode.subscribe((value) => {
  try {
    localStorage.setItem(DARK_MODE_KEY, String(value));
  } catch {
    // ignore
  }
});
