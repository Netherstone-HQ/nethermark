import { mountStyles } from "../styles/mount.js";
import { token } from "../theme/theme.js";

const line = `${token("borderWidth")} solid ${token("border")}`;

/**
 * The preview's CSS, in `@layer nme` like the rest, so any host rule beats
 * it. The editor and the preview share one grid cell in tabs, so switching
 * never changes the size, and sit side by side in split. The preview takes
 * the editor's height and scrolls.
 */
const css = `@layer nme {
  .nme-panes {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
  .nme-panes > * { grid-area: 1 / 1; min-width: 0; }
  .nme-panes[data-layout="split"][data-open] { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .nme-panes[data-layout="split"][data-open] > .nme-preview { grid-area: 1 / 2; border-inline-start: ${line}; }
  .nme-panes[data-layout="tabs"][data-open] > .cm-editor { visibility: hidden; }
  .nme-preview {
    contain: size;
    overflow: auto;
    overscroll-behavior: contain;
    box-sizing: border-box;
    padding: ${token("gap")};
    background: ${token("background")};
    color: ${token("foreground")};
    font-family: ${token("fontFamily")};
    font-size: ${token("fontSize")};
    line-height: ${token("lineHeight")};
    color-scheme: var(--nme-color-scheme);
    scrollbar-width: thin;
    scrollbar-color: ${token("scrollbarThumb")} transparent;
    overflow-wrap: break-word;
  }
  .nme-preview[hidden] { display: none; }
  .nme-preview:focus-visible { outline: ${token("focusRingWidth")} solid ${token("focusRing")}; }
  .nme-preview > :first-child { margin-top: 0; }
  .nme-preview > :last-child { margin-bottom: 0; }
  .nme-preview :is(h1, h2, h3, h4, h5, h6) { color: ${token("heading")}; }
  .nme-preview a { color: ${token("link")}; }
  .nme-preview img { max-width: 100%; height: auto; }
  .nme-preview code {
    font-family: ${token("monoFamily")};
    color: ${token("code")};
    background: ${token("codeBackground")};
    border-radius: ${token("radius")};
  }
  .nme-preview pre {
    padding: ${token("gap")};
    overflow-x: auto;
    background: ${token("codeBackground")};
    border-radius: ${token("radius")};
  }
  .nme-preview pre code { background: transparent; }
  .nme-preview blockquote {
    margin-inline: 0;
    padding-inline-start: ${token("gap")};
    border-inline-start: ${line};
    color: ${token("quote")};
  }
  .nme-preview table { border-collapse: collapse; display: block; overflow-x: auto; }
  .nme-preview :is(th, td) { border: ${line}; padding: 0 ${token("gap")}; }
  .nme-preview hr { border: none; border-top: ${token("borderWidth")} solid ${token("separator")}; }
}`;

/** Adds the preview's CSS to a document or shadow root, once. */
export function mountPreviewStyles(root: Document | ShadowRoot): void {
  mountStyles(root, css);
}
