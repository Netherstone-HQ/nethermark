import { HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { classFor, type ClassNames } from "../classes.js";

/**
 * The one highlight style, which gives syntax its stable `nme-` classes,
 * with any host classes for them. The colors come from the package CSS,
 * which reads them from the theme, so hosts recolor with tokens and never
 * write tag code.
 */
export function highlightStyle(names: ClassNames = {}): HighlightStyle {
  return HighlightStyle.define([
    { tag: tags.heading, class: classFor(names, "heading") },
    { tag: tags.strong, class: classFor(names, "strong") },
    { tag: tags.emphasis, class: classFor(names, "em") },
    { tag: tags.strikethrough, class: classFor(names, "strike") },
    { tag: tags.monospace, class: classFor(names, "code") },
    { tag: tags.link, class: classFor(names, "link") },
    { tag: [tags.url, tags.string], class: classFor(names, "url") },
    { tag: tags.quote, class: classFor(names, "quote") },
    { tag: tags.atom, class: classFor(names, "task-marker") },
    { tag: tags.comment, class: classFor(names, "comment") },
    { tag: [tags.processingInstruction, tags.labelName, tags.contentSeparator, tags.escape], class: classFor(names, "markup") },
  ]);
}

/** The highlight style with no host classes. */
export const markdownHighlight = highlightStyle();
