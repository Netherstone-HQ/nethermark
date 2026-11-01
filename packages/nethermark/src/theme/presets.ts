import type { Theme } from "./theme.js";

/** Type and shape shared by both presets. */
const shared = {
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  monoFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  fontSize: "15px",
  lineHeight: "1.6",
  headingScale: "1.1",
  radius: "7px",
  buttonSize: "32px",
  iconSize: "20px",
  gap: "4px",
  borderWidth: "1px",
  focusRingWidth: "2px",
} as const;

/**
 * Netherstone's Light theme. Every color is one of the app's Light tokens
 * (src/App.css in Netherstone-HQ/Netherstone): background and text, muted text
 * for markup, card white for the active line, secondary for selection and code,
 * sidebar for the toolbar, and the greens for headings, links and lists.
 */
export const light: Theme = {
  scheme: "light",
  ...shared,
  background: "#f6f5f2",
  foreground: "#141516",
  gutterBackground: "#f6f5f2",
  gutterForeground: "#6b6862",
  activeLine: "#ffffff",
  selection: "#eeebe5",
  cursor: "#2b6a5b",
  border: "#e3dfd8",
  toolbarBackground: "#efece6",
  buttonForeground: "#141516",
  buttonHover: "#e8e4dd",
  buttonPressed: "#e4e0d8",
  buttonPressedForeground: "#2b6a5b",
  focusRing: "#4fa38e",
  separator: "#e3dfd8",
  heading: "#2b6a5b",
  strong: "#141516",
  emphasis: "#141516",
  strike: "#6b6862",
  code: "#1f4f44",
  codeBackground: "#eeebe5",
  link: "#2b6a5b",
  url: "#6b6862",
  quote: "#6b6862",
  listMarker: "#2b6a5b",
  taskMarker: "#2b6a5b",
  markup: "#6b6862",
  tableBorder: "#6b6862",
  comment: "#6b6862",
  scrollbarThumb: "#cfcbc3",
  scrollbarThumbHover: "#a8a49c",
};

/**
 * Netherstone's Dark theme, from the app's Dark tokens the same way: card for
 * the active line and toolbar, secondary for selection, code and pressed
 * buttons, sidebar accent for hover, and the light greens.
 */
export const dark: Theme = {
  scheme: "dark",
  ...shared,
  background: "#141516",
  foreground: "#eeebe5",
  gutterBackground: "#141516",
  gutterForeground: "#a8a49c",
  activeLine: "#1c1d1f",
  selection: "#2a2c2e",
  cursor: "#8fd1be",
  border: "rgb(238 235 229 / 10%)",
  toolbarBackground: "#1c1d1f",
  buttonForeground: "#eeebe5",
  buttonHover: "#222325",
  buttonPressed: "#2a2c2e",
  buttonPressedForeground: "#8fd1be",
  focusRing: "#4fa38e",
  separator: "rgb(238 235 229 / 10%)",
  heading: "#8fd1be",
  strong: "#eeebe5",
  emphasis: "#eeebe5",
  strike: "#a8a49c",
  code: "#c4ebdf",
  codeBackground: "#2a2c2e",
  link: "#8fd1be",
  url: "#a8a49c",
  quote: "#a8a49c",
  listMarker: "#8fd1be",
  taskMarker: "#8fd1be",
  markup: "#a8a49c",
  tableBorder: "#a8a49c",
  comment: "#a8a49c",
  scrollbarThumb: "#3a3c3f",
  scrollbarThumbHover: "#5a5856",
};
