import { Facet } from "@codemirror/state";

/**
 * Every string the package shows or inserts, in English. Hosts translate or
 * reword them with the `labels` option, or `setLabels` later.
 */
export const defaultLabels = Object.freeze({
  /** The toolbar's accessible name. */
  toolbar: "Formatting",
  /** The menu that holds what doesn't fit on the bar. */
  more: "More",
  /** The menu of table commands, shown in a table. */
  tableMenu: "Table",

  bold: "Bold",
  italic: "Italic",
  strikethrough: "Strikethrough",
  inlineCode: "Inline code",
  heading1: "Heading 1",
  heading2: "Heading 2",
  heading3: "Heading 3",
  heading4: "Heading 4",
  heading5: "Heading 5",
  heading6: "Heading 6",
  bulletList: "Bullet list",
  orderedList: "Numbered list",
  taskList: "Task list",
  quote: "Quote",
  link: "Link",
  image: "Image",
  codeBlock: "Code block",
  table: "Table",
  horizontalRule: "Horizontal rule",

  addRowAbove: "Add row above",
  addRowBelow: "Add row below",
  addColumnLeft: "Add column left",
  addColumnRight: "Add column right",
  deleteRow: "Delete row",
  deleteColumn: "Delete column",
  alignColumnLeft: "Align left",
  alignColumnCenter: "Align center",
  alignColumnRight: "Align right",
  formatTable: "Format table",

  /** A new table's header cells. `{n}` is the column's number. */
  tableColumn: "Column {n}",
  /** The alt text a new image gets when nothing is selected. */
  imageAlt: "alt",
  /** The URL a new link or image gets, selected for typing over. */
  url: "url",

  /** Modifier keys in tooltips, outside macOS, which shows symbols. */
  keyCtrl: "Ctrl",
  keyAlt: "Alt",
  keyShift: "Shift",
  keyMeta: "Win",
});

export type LabelName = keyof typeof defaultLabels;

/** Strings to replace, by name. Ones left out keep their defaults. */
export type Labels = { readonly [name in LabelName]?: string };

/** The strings in this editor: the defaults, with the host's on top. */
export const labelsFacet = Facet.define<Labels, Readonly<Record<LabelName, string>>>({
  combine: (values) => Object.assign({}, defaultLabels, ...values) as Record<LabelName, string>,
});

/** Fills a label's `{name}` slots. */
export function fillLabel(label: string, values: Readonly<Record<string, string | number>>): string {
  return label.replace(/\{(\w+)\}/g, (slot, name: string) => (name in values ? String(values[name]) : slot));
}
