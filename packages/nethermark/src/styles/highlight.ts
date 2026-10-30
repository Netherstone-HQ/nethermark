import { HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/**
 * The one highlight style, which gives syntax its stable `nme-` classes.
 * The colors come from the package CSS, which reads them from the theme, so
 * hosts recolor with tokens and never write tag code.
 */
export const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading, class: "nme-heading" },
  { tag: tags.strong, class: "nme-strong" },
  { tag: tags.emphasis, class: "nme-em" },
  { tag: tags.strikethrough, class: "nme-strike" },
  { tag: tags.monospace, class: "nme-code" },
  { tag: tags.link, class: "nme-link" },
  { tag: [tags.url, tags.string], class: "nme-url" },
  { tag: tags.quote, class: "nme-quote" },
  { tag: tags.atom, class: "nme-task-marker" },
  { tag: tags.comment, class: "nme-comment" },
  { tag: [tags.processingInstruction, tags.labelName, tags.contentSeparator, tags.escape], class: "nme-markup" },
]);
