import { EditorView } from "@codemirror/view";
import { COLOR_SCHEME, token } from "../theme/theme.js";

/** An H<n> line is fontSize × headingScale^(6−n). */
function headingSize(level: number): string {
  return `calc(${[token("fontSize"), ...Array<string>(6 - level).fill(token("headingScale"))].join(" * ")})`;
}

const headings = Object.fromEntries([1, 2, 3, 4, 5, 6].map((level) => [`.nme-line-h${level}`, { fontSize: headingSize(level) }]));

/**
 * The package's own CSS, in `@layer nme`, so any host rule beats it without
 * `!important`. Every value is a theme token.
 */
export const layeredStyles = EditorView.baseTheme({
  "@layer nme": {
    ".nme-heading": { color: token("heading"), fontWeight: "bold" },
    ".nme-strong": { color: token("strong"), fontWeight: "bold" },
    ".nme-em": { color: token("emphasis"), fontStyle: "italic" },
    ".nme-strike": { color: token("strike"), textDecoration: "line-through" },
    ".nme-code": {
      color: token("code"),
      fontFamily: token("monoFamily"),
      backgroundColor: token("codeBackground"),
      borderRadius: token("radius"),
    },
    ".nme-link": { color: token("link"), textDecoration: "underline" },
    ".nme-url": { color: token("url") },
    ".nme-quote": { color: token("quote") },
    ".nme-comment": { color: token("comment") },
    // Markers come after the formats they sit in, so their color wins on
    // the spans that carry both classes.
    ".nme-markup": { color: token("markup") },
    ".nme-task-marker, .nme-task-marker .nme-markup": { color: token("taskMarker") },
    ".nme-list-marker, .nme-list-marker .nme-markup": { color: token("listMarker") },
    ".nme-table-border, .nme-table-border .nme-markup": { color: token("tableBorder") },
    ...headings,
    ".nme-line-fence": { fontFamily: token("monoFamily"), backgroundColor: token("codeBackground") },
    ".nme-line-fence .nme-code": { backgroundColor: "transparent", borderRadius: "0" },
    ".nme-line-table": { fontFamily: token("monoFamily") },
  },
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
