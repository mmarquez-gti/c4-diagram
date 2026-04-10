import { atom } from 'nanostores';

/** Whether the left Diagrams panel is visible */
export const $leftPanelOpen = atom<boolean>(true);

/** Whether the right Properties panel is visible */
export const $rightPanelOpen = atom<boolean>(true);
