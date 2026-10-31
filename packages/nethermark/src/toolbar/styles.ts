import { token } from "../theme/theme.js";

const ring = `${token("focusRingWidth")} solid ${token("focusRing")}`;

/**
 * The toolbar's CSS, in `@layer nme` like the rest, so any host rule beats
 * it. It reads only tokens, which the toolbar carries on its own element.
 */
const css = `@layer nme {
  .nme-toolbar {
    position: relative;
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: ${token("gap")};
    padding: ${token("gap")};
    min-width: 0;
    background: ${token("toolbarBackground")};
    color: ${token("buttonForeground")};
    border-bottom: ${token("borderWidth")} solid ${token("border")};
    font-family: ${token("fontFamily")};
    font-size: ${token("fontSize")};
    color-scheme: var(--nme-color-scheme);
    /* A long press on a button shows its label, not a text selection or the browser's callout. */
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    touch-action: manipulation;
  }
  .nme-toolbar [hidden] { display: none; }
  .nme-button, .nme-menu-item {
    display: inline-flex;
    align-items: center;
    flex: none;
    gap: ${token("gap")};
    min-height: ${token("buttonSize")};
    border: none;
    border-radius: ${token("radius")};
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .nme-button {
    justify-content: center;
    min-width: ${token("buttonSize")};
    padding: 0 ${token("gap")};
  }
  /* Only where there's hover: on touch screens a tapped button would stay lit. */
  @media (hover: hover) {
    .nme-button:hover, .nme-menu-item:hover { background: ${token("buttonHover")}; }
  }
  .nme-button[aria-pressed="true"], .nme-button[aria-expanded="true"], .nme-menu-item[aria-checked="true"] {
    background: ${token("buttonPressed")};
    color: ${token("buttonPressedForeground")};
  }
  .nme-button:focus-visible, .nme-menu-item:focus-visible { outline: ${ring}; }
  .nme-button:disabled, .nme-menu-item:disabled { color: ${token("separator")}; cursor: default; background: transparent; }
  .nme-icon { width: ${token("iconSize")}; height: ${token("iconSize")}; flex: none; }
  .nme-icon-text { min-width: ${token("iconSize")}; font-weight: bold; text-align: center; }
  .nme-separator {
    flex: none;
    align-self: stretch;
    width: ${token("borderWidth")};
    background: ${token("separator")};
  }
  .nme-menu-anchor, .nme-more { position: relative; flex: none; }
  .nme-more { margin-inline-start: auto; }
  .nme-menu {
    position: absolute;
    top: 100%;
    inset-inline-end: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: ${token("gap")};
    box-sizing: border-box;
    min-width: max-content;
    padding: ${token("gap")};
    background: ${token("toolbarBackground")};
    border: ${token("borderWidth")} solid ${token("border")};
    border-radius: ${token("radius")};
    max-height: var(--nme-menu-max-height, none);
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .nme-menu[data-align="start"] { inset-inline-end: auto; inset-inline-start: 0; }
  .nme-tooltip {
    position: absolute;
    left: var(--nme-tooltip-x, 0);
    top: var(--nme-tooltip-y, 0);
    z-index: 2;
    padding: ${token("gap")};
    background: ${token("foreground")};
    color: ${token("background")};
    border-radius: ${token("radius")};
    white-space: nowrap;
    pointer-events: none;
  }
  .nme-tooltip[data-side="above"] { transform: translateY(calc(-100% - ${token("gap")})); }
  .nme-tooltip[data-side="below"] { margin-top: ${token("gap")}; }
  .nme-menu-item { padding: 0 ${token("gap")}; text-align: start; white-space: nowrap; }
  .nme-menu-separator { height: ${token("borderWidth")}; background: ${token("separator")}; }
}`;

const mounted = new WeakSet<Document | ShadowRoot>();

/** Adds the toolbar's CSS to a document or shadow root, once. */
export function mountToolbarStyles(root: Document | ShadowRoot): void {
  if (mounted.has(root)) return;
  const doc = "host" in root ? root.ownerDocument : root;
  const Sheet = doc.defaultView?.CSSStyleSheet ?? CSSStyleSheet;
  const sheet = new Sheet();
  sheet.replaceSync(css);
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  mounted.add(root);
}
