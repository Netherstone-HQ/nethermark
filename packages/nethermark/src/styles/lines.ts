import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { Decoration, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from "@codemirror/view";

/** The class each kind of block gives every line it spans. */
const LINE_CLASSES: Readonly<Record<string, string>> = {
  ATXHeading1: "nme-line-h1",
  ATXHeading2: "nme-line-h2",
  ATXHeading3: "nme-line-h3",
  ATXHeading4: "nme-line-h4",
  ATXHeading5: "nme-line-h5",
  ATXHeading6: "nme-line-h6",
  SetextHeading1: "nme-line-h1",
  SetextHeading2: "nme-line-h2",
  Blockquote: "nme-line-quote",
  ListItem: "nme-line-list",
  FencedCode: "nme-line-fence",
  Table: "nme-line-table",
};

/**
 * Marks the parser tags only as generic markup, which get a class of their
 * own so their tokens can color them apart from other markers.
 */
const MARK_CLASSES: Readonly<Record<string, string>> = {
  ListMark: "nme-list-marker",
  TableDelimiter: "nme-table-border",
};

/** The line and mark classes for the parts of the doc in `ranges`, from the syntax tree. */
export function styleDecorations(state: EditorState, ranges: readonly { from: number; to: number }[]): DecorationSet {
  const tree = syntaxTree(state);
  const lines = new Map<number, Set<string>>();
  const marks = new Map<string, { from: number; to: number; className: string }>();
  const addLines = (from: number, to: number, className: string) => {
    for (let pos = from; pos <= to; ) {
      const line = state.doc.lineAt(pos);
      const classes = lines.get(line.from) ?? new Set<string>();
      classes.add(className);
      lines.set(line.from, classes);
      pos = line.to + 1;
    }
  };
  for (const range of ranges) {
    tree.iterate({
      from: range.from,
      to: range.to,
      enter: (node) => {
        const line = LINE_CLASSES[node.name];
        if (line) addLines(Math.max(node.from, range.from), Math.min(node.to, range.to), line);
        if (node.name === "TaskMarker") addLines(node.from, node.from, "nme-line-task");
        const mark = MARK_CLASSES[node.name];
        if (mark && node.to > node.from) marks.set(`${node.from}:${mark}`, { from: node.from, to: node.to, className: mark });
      },
    });
  }
  return Decoration.set(
    [
      ...[...lines].map(([from, classes]) => Decoration.line({ class: [...classes].sort().join(" ") }).range(from)),
      ...[...marks.values()].map((mark) => Decoration.mark({ class: mark.className }).range(mark.from, mark.to)),
    ],
    true,
  );
}

/** Line kinds and marker classes for the visible lines only, so long files stay fast. */
export const lineStyles = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = styleDecorations(view.state, view.visibleRanges);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || syntaxTree(update.startState) !== syntaxTree(update.state)) {
        this.decorations = styleDecorations(update.state, update.view.visibleRanges);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);
