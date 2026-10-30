import { syntaxHighlighting } from "@codemirror/language";
import { Facet, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { themeStyle, type Theme } from "../theme/theme.js";
import { codeMirrorStyles, layeredStyles } from "./css.js";
import { markdownHighlight } from "./highlight.js";
import { lineStyles } from "./lines.js";

/** Everything that draws the editor from a theme's tokens, except the tokens themselves. */
export const editorStyles: Extension = [syntaxHighlighting(markdownHighlight), lineStyles, layeredStyles, codeMirrorStyles];

/** The editor's theme, for parts outside the editor, like a toolbar, to draw with. */
export const themeFacet = Facet.define<Theme, Theme | null>({ combine: (values) => values[0] ?? null });

/**
 * A theme's tokens as custom properties on the editor, the only inline
 * style the package sets, and CodeMirror's dark flag for its own parts.
 */
export function themeExtension(theme: Theme): Extension {
  return [
    themeFacet.of(theme),
    EditorView.editorAttributes.of({ style: themeStyle(theme) }),
    EditorView.darkTheme.of(theme.scheme === "dark"),
  ];
}
