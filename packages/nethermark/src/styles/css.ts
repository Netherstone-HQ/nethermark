import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { mountStyles } from "./mount.js";
import { COLOR_SCHEME, token } from "../theme/theme.js";

/** An H<n> line, or heading, is fontSize × headingScale^(6−n). */
export function headingSize(level: number): string {
  return `calc(${[token("fontSize"), ...Array<string>(6 - level).fill(token("headingScale"))].join(" * ")})`;
}

const headings = [1, 2, 3, 4, 5, 6].map((level) => `.cm-editor .nme-line-h${level} { font-size: ${headingSize(level)}; }`).join("\n  ");

/**
 * The package's own CSS, in `@layer nme`, so any host rule beats it without
 * `!important`. Every value is a theme token.
 */
const css = `@layer nme {
  .cm-editor .nme-heading { color: ${token("heading")}; font-weight: bold; }
  .cm-editor .nme-strong { color: ${token("strong")}; font-weight: bold; }
  .cm-editor .nme-em { color: ${token("emphasis")}; font-style: italic; }
  .cm-editor .nme-strike { color: ${token("strike")}; text-decoration: line-through; }
  .cm-editor .nme-code {
    color: ${token("code")};
    font-family: ${token("monoFamily")};
    background-color: ${token("codeBackground")};
    border-radius: ${token("radius")};
  }
  .cm-editor .nme-link { color: ${token("link")}; text-decoration: underline; }
  .cm-editor .nme-url { color: ${token("url")}; }
  .cm-editor .nme-quote { color: ${token("quote")}; }
  .cm-editor .nme-comment { color: ${token("comment")}; }
  /* Markers come after the formats they sit in, so their color wins on the spans that carry both classes. */
  .cm-editor .nme-markup { color: ${token("markup")}; }
  .cm-editor .nme-task-marker, .cm-editor .nme-task-marker .nme-markup { color: ${token("taskMarker")}; }
  .cm-editor .nme-list-marker, .cm-editor .nme-list-marker .nme-markup { color: ${token("listMarker")}; }
  .cm-editor .nme-table-border, .cm-editor .nme-table-border .nme-markup { color: ${token("tableBorder")}; }
  ${headings}
  .cm-editor .nme-line-fence { font-family: ${token("monoFamily")}; background-color: ${token("codeBackground")}; }
  .cm-editor .nme-line-fence .nme-code { background-color: transparent; border-radius: 0; }
  .cm-editor .nme-line-table { font-family: ${token("monoFamily")}; }
}`;

/**
 * Adds the layered CSS to the editor's document or shadow root. It goes in
 * after the page's own sheets, where the `nme` layer is first named after a
 * host's layers, like Tailwind's base, so their resets don't wipe it.
 * CodeMirror's own style tags go first in the head, which would make `nme`
 * the lowest layer of all. A host that wants its utility layer to beat
 * `nme` names the order first, like `@layer theme, base, nme, components, utilities;`.
 */
export const layeredStyles = ViewPlugin.define((view) => {
  const mount = (root: Document | ShadowRoot) => {
    mountStyles(root, css);
    return root;
  };
  let root = mount(view.root as Document | ShadowRoot);
  return {
    update: (update: ViewUpdate) => {
      // The editor can move into another root, like a shadow root, after it's built.
      if (update.view.root !== root) root = mount(update.view.root as Document | ShadowRoot);
    },
  };
});

/**
 * Values for the parts CodeMirror styles itself. Its own defaults aren't in
 * a layer, so these can't be either: they'd lose to them. They hold nothing
 * but tokens, so hosts change these parts through their theme, or with a
 * selector more specific than these.
 */
export const codeMirrorStyles = EditorView.theme({
  "&": {
    color: token("foreground"),
    backgroundColor: token("background"),
    fontSize: token("fontSize"),
    colorScheme: `var(${COLOR_SCHEME})`,
  },
  "&.cm-focused": { outline: `${token("focusRingWidth")} solid ${token("focusRing")}` },
  ".cm-scroller": {
    fontFamily: token("fontFamily"),
    lineHeight: token("lineHeight"),
    scrollbarWidth: "thin",
    scrollbarColor: `${token("scrollbarThumb")} transparent`,
  },
  ".cm-scroller:hover": { scrollbarColor: `${token("scrollbarThumbHover")} transparent` },
  ".cm-content": { caretColor: token("cursor") },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: token("cursor") },
  ".cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-content ::selection": {
    background: token("selection"),
  },
  ".cm-activeLine": { backgroundColor: token("activeLine") },
  ".cm-gutters": {
    backgroundColor: token("gutterBackground"),
    color: token("gutterForeground"),
    border: "none",
    borderRight: `${token("borderWidth")} solid ${token("border")}`,
  },
  ".cm-activeLineGutter": { backgroundColor: token("activeLine") },
  ".cm-placeholder": { color: token("markup") },
});
