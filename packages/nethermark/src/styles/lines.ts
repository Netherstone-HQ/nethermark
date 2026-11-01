import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder, StateField, type EditorState, type RangeSet } from "@codemirror/state";
import { Decoration, GutterMarker, ViewPlugin, gutterLineClass, type DecorationSet, type EditorView, type ViewUpdate } from "@codemirror/view";
import { classFor, classNamesFacet, type Part } from "../classes.js";

/** The part each kind of block makes of every line it spans. */
const LINE_PARTS: Readonly<Record<string, Part>> = {
  ATXHeading1: "line-h1",
  ATXHeading2: "line-h2",
  ATXHeading3: "line-h3",
  ATXHeading4: "line-h4",
  ATXHeading5: "line-h5",
  ATXHeading6: "line-h6",
  SetextHeading1: "line-h1",
  SetextHeading2: "line-h2",
  Blockquote: "line-quote",
  ListItem: "line-list",
  FencedCode: "line-fence",
  Table: "line-table",
};

/**
 * Marks the parser tags only as generic markup, which get a class of their
 * own so their tokens can color them apart from other markers.
 */
const MARK_PARTS: Readonly<Record<string, Part>> = {
  ListMark: "list-marker",
  TableDelimiter: "table-border",
};

/** The line and mark classes for the parts of the doc in `ranges`, from the syntax tree. */
export function styleDecorations(state: EditorState, ranges: readonly { from: number; to: number }[]): DecorationSet {
  const tree = syntaxTree(state);
  const names = state.facet(classNamesFacet);
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
        const line = LINE_PARTS[node.name];
        if (line) addLines(Math.max(node.from, range.from), Math.min(node.to, range.to), classFor(names, line));
        if (node.name === "TaskMarker") addLines(node.from, node.from, classFor(names, "line-task"));
        const part = MARK_PARTS[node.name];
        const mark = part && classFor(names, part);
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

/** Puts `nme-gutter-h<n>` on the gutter cells beside an H<n> line, so their numbers can sit on its baseline. */
class HeadingGutterMarker extends GutterMarker {
  constructor(readonly level: number) {
    super();
    this.elementClass = `nme-gutter-h${level}`;
  }
  override eq(other: GutterMarker): boolean {
    return other instanceof HeadingGutterMarker && other.level === this.level;
  }
}

const headingMarkers = [1, 2, 3, 4, 5, 6].map((level) => new HeadingGutterMarker(level));
const HEADING = /^(?:ATX|Setext)Heading(\d)$/;
/** Blocks that never hold a heading, skipped so the walk stays at block level. */
const LEAF_BLOCKS = new Set(["Paragraph", "FencedCode", "CodeBlock", "Table", "HTMLBlock", "LinkReference", "HorizontalRule"]);

/** The gutter classes for every heading line the parser has reached. */
function headingGutters(state: EditorState): RangeSet<GutterMarker> {
  const builder = new RangeSetBuilder<GutterMarker>();
  syntaxTree(state).iterate({
    enter: (node) => {
      const level = HEADING.exec(node.name)?.[1];
      if (level) {
        const marker = headingMarkers[Number(level) - 1]!;
        for (let pos = node.from; pos <= node.to; ) {
          const line = state.doc.lineAt(pos);
          builder.add(line.from, line.from, marker);
          pos = line.to + 1;
        }
        return false;
      }
      return !LEAF_BLOCKS.has(node.name);
    },
  });
  return builder.finish();
}

/** Heading classes for the line-number gutter, kept in step with the syntax tree. */
export const headingGutter = StateField.define<RangeSet<GutterMarker>>({
  create: headingGutters,
  update: (markers, tr) => (syntaxTree(tr.startState) === syntaxTree(tr.state) ? markers : headingGutters(tr.state)),
  provide: (field) => gutterLineClass.from(field),
});
