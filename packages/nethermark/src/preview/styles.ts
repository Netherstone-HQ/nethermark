import { headingSize } from "../styles/css.js";
import { mountStyles } from "../styles/mount.js";
import { token } from "../theme/theme.js";

const line = `${token("borderWidth")} solid ${token("border")}`;

/** Headings at the editor's sizes, so a heading reads the same on both sides. */
const headings = [1, 2, 3, 4, 5, 6].map((level) => `.nme-preview h${level} { font-size: ${headingSize(level)}; }`).join("\n  ");

/**
 * The preview's CSS, in `@layer nme` like the rest, so any host rule beats
 * it. The editor and the preview share one grid cell in tabs, so switching
 * never changes the size, and sit side by side in split. The preview takes
 * the editor's height and scrolls.
 *
 * The preview draws its own type, spacing and list markers rather than
 * leaning on the browser's defaults, which a host's reset, like Tailwind's
 * preflight, takes away. Spacing is in `em`, so it follows the theme's sizes,
 * and the text keeps a reading inset from the editor beside it.
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
    padding: 1em 1.5em;
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
  .nme-preview :is(p, ul, ol, dl, blockquote, pre, table, figure, details, hr) { margin-block: 1em; }
  .nme-preview :is(h1, h2, h3, h4, h5, h6) { margin-block: 1em 0.5em; font-weight: bold; }
  ${headings}
  .nme-preview :is(ul, ol) { padding-inline-start: 2em; }
  .nme-preview ul { list-style-type: disc; }
  .nme-preview ol { list-style-type: decimal; }
  .nme-preview :is(ul, ol) ul { list-style-type: circle; }
  .nme-preview :is(ul, ol) :is(ul, ol) ul { list-style-type: square; }
  .nme-preview li :is(ul, ol) { margin-block: 0; }
  .nme-preview dd { margin-inline-start: 2em; }
  .nme-preview :is(strong, b, th, dt) { font-weight: bold; }
  .nme-preview th { text-align: start; }
  .nme-preview > :first-child { margin-top: 0; }
  .nme-preview > :last-child { margin-bottom: 0; }
  .nme-preview :is(h1, h2, h3, h4, h5, h6) { color: ${token("heading")}; }
  .nme-preview a { color: ${token("link")}; text-decoration: underline; }
  .nme-preview img { max-width: 100%; height: auto; }
  .nme-preview code {
    padding: 0.1em 0.3em;
    font-family: ${token("monoFamily")};
    color: ${token("code")};
    background: ${token("codeBackground")};
    border-radius: ${token("radius")};
  }
  .nme-preview pre {
    padding: 0.75em 1em;
    overflow-x: auto;
    background: ${token("codeBackground")};
    border-radius: ${token("radius")};
  }
  .nme-preview pre code { padding: 0; background: transparent; }
  .nme-preview blockquote {
    margin-inline: 0;
    padding-inline-start: 1em;
    border-inline-start: ${line};
    color: ${token("quote")};
  }
  .nme-preview table { border-collapse: collapse; display: block; overflow-x: auto; }
  .nme-preview :is(th, td) { border: ${line}; padding: 0.25em 0.75em; }
  .nme-preview hr { border: none; border-top: ${token("borderWidth")} solid ${token("separator")}; }
}`;

/** Adds the preview's CSS to a document or shadow root, once. */
export function mountPreviewStyles(root: Document | ShadowRoot): void {
  mountStyles(root, css);
}
