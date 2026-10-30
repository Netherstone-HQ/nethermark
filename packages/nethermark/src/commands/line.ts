import type { ChangeSet, ChangeSpec, EditorState, Line, TransactionSpec } from "@codemirror/state";
import type { SyntaxNode, Tree } from "@lezer/common";
import { defineCommand, type MarkdownCommand } from "./command.js";
import { ancestors, children, treeUpTo } from "./tree.js";

type Kind = "text" | "heading" | "bullet" | "ordered" | "task";

/** Blocks whose lines line commands leave alone, except quote. */
const STRUCTURAL = new Set([
  "FencedCode", "CodeBlock", "HTMLBlock", "CommentBlock", "ProcessingInstructionBlock",
  "Table", "HorizontalRule", "LinkReference",
]);

/** The most spaces CommonMark allows between a list marker and its text. */
const MAX_MARKER_GAP = 4;

/**
 * A line split into its prefix and text. Offsets are into the line's text:
 * quote markers end at `quoteEnd`, indentation at `indentEnd`, and the list
 * or heading marker with its spaces at `textStart`.
 */
type LineModel = {
  readonly line: Line;
  readonly quoteEnd: number;
  readonly indentEnd: number;
  readonly textStart: number;
  readonly kind: Kind;
  readonly level: number;
  readonly bullet: string;
  readonly delimiter: string;
  /** A Setext heading's underline, removed when the heading changes. */
  readonly underline: Line | null;
  /** Blank, or after a quote marker only spaces. */
  readonly blank: boolean;
  /** In code, a table, a rule or a link definition. */
  readonly structural: boolean;
  /** A later line of a list item, which follows its first line. */
  readonly continuation: SyntaxNode | null;
};

/** Spaces after a marker that belong to it: one to four, or one before indented code. */
function markerGap(text: string, at: number): number {
  let gap = 0;
  while (text[at + gap] === " ") gap++;
  return gap > MAX_MARKER_GAP ? 1 : gap;
}

function lineModel(state: EditorState, tree: Tree, line: Line): LineModel {
  const text = line.text;
  let quoteEnd = 0;
  for (let at = 0; at < text.length; ) {
    let spaces = 0;
    while (text[at + spaces] === " ") spaces++;
    const mark = at + spaces;
    if (text[mark] !== ">" || tree.resolveInner(line.from + mark, 1).name !== "QuoteMark") break;
    at = quoteEnd = mark + 1 + (text[mark + 1] === " " ? 1 : 0);
  }
  let indentEnd = quoteEnd;
  while (text[indentEnd] === " " || text[indentEnd] === "\t") indentEnd++;

  const model = {
    line,
    quoteEnd,
    indentEnd,
    textStart: indentEnd,
    kind: "text" as Kind,
    level: 0,
    bullet: "-",
    delimiter: ".",
    underline: null as Line | null,
    blank: text.slice(quoteEnd).trim() === "",
    structural: false,
    continuation: null as SyntaxNode | null,
  };

  const pos = line.from + indentEnd;
  const node = tree.resolveInner(pos, 1);
  if (node.name === "ListMark" && node.from === pos && node.parent) {
    const item = node.parent;
    const mark = state.sliceDoc(node.from, node.to);
    model.textStart = node.to - line.from + markerGap(text, node.to - line.from);
    if (item.parent?.name === "OrderedList") {
      model.kind = "ordered";
      model.delimiter = mark.slice(-1);
    } else {
      model.kind = "bullet";
      model.bullet = mark;
      const taskMarker = children(item).find((child) => child.name === "Task")?.firstChild;
      if (taskMarker?.name === "TaskMarker" && taskMarker.from === line.from + model.textStart) {
        model.kind = "task";
        model.textStart = taskMarker.to - line.from + Math.min(1, markerGap(text, taskMarker.to - line.from));
      }
    }
    return model;
  }

  for (const parent of ancestors(tree, pos, 1)) {
    if (STRUCTURAL.has(parent.name)) {
      model.structural = true;
      return model;
    }
    const heading = /^(ATX|Setext)Heading(\d)$/.exec(parent.name);
    if (heading) {
      const marks = children(parent).filter((child) => child.name === "HeaderMark");
      model.kind = "heading";
      model.level = Number(heading[2]);
      if (heading[1] === "ATX") {
        const open = marks[0];
        if (open && open.from === pos) model.textStart = open.to - line.from + markerGap(text, open.to - line.from);
      } else {
        const underline = marks[0] ? state.doc.lineAt(marks[0].from) : null;
        if (underline?.number === line.number) {
          model.structural = true;
          return model;
        }
        model.underline = underline;
      }
      return model;
    }
    if (parent.name === "ListItem" && parent.from < line.from) {
      // Indented to the item's text, the line belongs to it. A lazy line,
      // indented less, reads as a line of its own.
      const first = lineModel(state, tree, state.doc.lineAt(parent.from));
      if (indentEnd - quoteEnd >= first.textStart - first.quoteEnd) model.continuation = parent;
      return model;
    }
  }
  return model;
}

/** Each line a selection touches, once, in order. A range ending at a line's start leaves that line out. */
function touchedLines(state: EditorState): Line[] {
  const numbers = new Set<number>();
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    let last = state.doc.lineAt(range.to).number;
    if (!range.empty && last > first && state.doc.line(last).from === range.to) last--;
    for (let n = first; n <= last; n++) numbers.add(n);
  }
  return [...numbers].sort((a, b) => a - b).map((n) => state.doc.line(n));
}

type Target = { kind: Kind; level?: number; delimiter?: string };

const matches = (model: LineModel, target: Target) =>
  model.kind === target.kind && (target.kind !== "heading" || model.level === target.level);

/** The changes that give a line a new kind, keeping its quote markers and its text. */
function setKind(state: EditorState, model: LineModel, target: Target): ChangeSpec[] {
  const { line } = model;
  const indent = line.text.slice(model.quoteEnd, model.indentEnd);
  const bullet = model.kind === "bullet" || model.kind === "task" ? model.bullet : "-";
  const delimiter = model.kind === "ordered" ? model.delimiter : (target.delimiter ?? ".");
  const prefix =
    target.kind === "heading" ? "#".repeat(target.level ?? 1) + " "
    : target.kind === "bullet" ? `${indent}${bullet} `
    : target.kind === "ordered" ? `${indent}1${delimiter} `
    : target.kind === "task" ? `${indent}${bullet} [ ] `
    : indent;
  const from = line.from + model.quoteEnd;
  const to = line.from + model.textStart;
  const changes: ChangeSpec[] = [];
  if (state.sliceDoc(from, to) !== prefix) changes.push({ from, to, insert: prefix });
  if (model.underline) changes.push({ from: model.underline.from - 1, to: model.underline.to });
  return changes;
}

/**
 * Numbers the items of every ordered list in a range from the first item
 * the range touches: each one follows the item before it, and a list's
 * first item keeps its number.
 */
function renumber(state: EditorState, from: number, to: number): ChangeSpec[] {
  const tree = treeUpTo(state, state.doc.length);
  const changes: ChangeSpec[] = [];
  tree.iterate({
    from,
    to,
    enter: (ref) => {
      if (ref.name !== "OrderedList") return;
      let previous: number | null = null;
      for (const item of children(ref.node)) {
        const mark = item.firstChild;
        if (item.name !== "ListItem" || mark?.name !== "ListMark") continue;
        const text = state.sliceDoc(mark.from, mark.to);
        const number = Number.parseInt(text, 10);
        const wanted: number = item.to < from || previous === null ? number : previous + 1;
        if (wanted !== number) changes.push({ from: mark.from, to: mark.to, insert: `${wanted}${text.slice(-1)}` });
        previous = wanted;
      }
    },
  });
  return changes;
}

/** A transaction for line changes, with ordered lists renumbered after them. */
function lineTransaction(state: EditorState, specs: ChangeSpec[], lines: readonly Line[]): TransactionSpec | null {
  if (specs.length === 0) return null;
  const first = lines[0]!;
  const last = lines[lines.length - 1]!;
  let changes: ChangeSet = state.changes(specs);
  const next = state.update({ changes }).state;
  const renumbering = renumber(next, changes.mapPos(first.from, -1), changes.mapPos(last.to, 1));
  if (renumbering.length > 0) changes = changes.compose(next.changes(renumbering));
  return { changes, selection: state.selection.map(changes, 1) };
}

/**
 * The models of the touched lines a list or heading command changes. A list
 * item's later lines follow its first line when that's touched too; on their
 * own, they're lines like any other.
 */
function candidates(state: EditorState): { lines: Line[]; models: LineModel[] } {
  const lines = touchedLines(state);
  const tree = treeUpTo(state, lines[lines.length - 1]!.to);
  const touched = new Set(lines.map((line) => line.from));
  const models = lines
    .map((line) => lineModel(state, tree, line))
    .filter((model) => !model.blank && !model.structural)
    .filter((model) => !model.continuation || !touched.has(state.doc.lineAt(model.continuation.from).from));
  return { lines, models };
}

/** The model of the line the main cursor is on. */
function mainModel(state: EditorState): LineModel {
  const line = state.doc.lineAt(state.selection.main.head);
  return lineModel(state, treeUpTo(state, line.to), line);
}

/**
 * The delimiter new ordered items use: that of an ordered line among them or
 * just above them, since `1.` and `1)` items make separate lists.
 */
function listDelimiter(state: EditorState, models: readonly LineModel[]): string {
  const ordered = models.find((model) => model.kind === "ordered");
  if (ordered) return ordered.delimiter;
  const first = models[0]!.line;
  const last = models[models.length - 1]!.line;
  const tree = treeUpTo(state, Math.min(state.doc.length, last.to + 1));
  for (const n of [first.number - 1, last.number + 1]) {
    if (n < 1 || n > state.doc.lines) continue;
    const neighbour = lineModel(state, tree, state.doc.line(n));
    if (neighbour.kind === "ordered") return neighbour.delimiter;
  }
  return ".";
}

function lineCommand(target: Target): MarkdownCommand {
  return defineCommand({
    run: (state) => {
      const { lines, models } = candidates(state);
      if (models.length === 0) return null;
      const all = models.every((model) => matches(model, target));
      const wanted = target.kind === "ordered" ? { ...target, delimiter: listDelimiter(state, models) } : target;
      const specs = all
        ? models.flatMap((model) => setKind(state, model, { kind: "text" }))
        : models.filter((model) => !matches(model, target)).flatMap((model) => setKind(state, model, wanted));
      return lineTransaction(state, specs, lines);
    },
    isActive: (state) => matches(mainModel(state), target),
  });
}

export const headingCommands = [1, 2, 3, 4, 5, 6].map((level) => lineCommand({ kind: "heading", level })) as [
  MarkdownCommand, MarkdownCommand, MarkdownCommand, MarkdownCommand, MarkdownCommand, MarkdownCommand,
];
export const bulletListCommand = lineCommand({ kind: "bullet" });
export const orderedListCommand = lineCommand({ kind: "ordered" });
export const taskListCommand = lineCommand({ kind: "task" });

export const paragraphCommand = defineCommand({
  run: (state) => {
    const { lines, models } = candidates(state);
    const specs = models.filter((model) => model.kind !== "text").flatMap((model) => setKind(state, model, { kind: "text" }));
    return lineTransaction(state, specs, lines);
  },
  isActive: (state) => {
    const model = mainModel(state);
    return model.kind === "text" && !model.structural;
  },
});

// ── Quote ───────────────────────────────────────────────────────────────────

const CODE_BLOCKS = new Set(["FencedCode", "CodeBlock", "HTMLBlock", "CommentBlock"]);

/**
 * Whether a line can be quoted on its own: any line outside code, and a line
 * of code only with every line of its block, since a quote marker on one
 * line of code would just be more code.
 */
function wholeBlockTouched(state: EditorState, tree: Tree, line: Line, touched: ReadonlySet<number>): boolean {
  const start = line.from + (line.text.length - line.text.trimStart().length);
  for (const side of [1, -1] as const) {
    for (const node of ancestors(tree, start, side)) {
      if (!CODE_BLOCKS.has(node.name)) continue;
      const first = state.doc.lineAt(node.from).number;
      const last = state.doc.lineAt(node.to).number;
      for (let n = first; n <= last; n++) if (!touched.has(n)) return false;
      return true;
    }
  }
  return true;
}

export const quoteCommand = defineCommand({
  run: (state) => {
    const lines = touchedLines(state);
    const tree = treeUpTo(state, lines[lines.length - 1]!.to);
    const touched = new Set(lines.map((line) => line.number));
    const models = lines
      .filter((line) => line.text.trim() !== "" && wholeBlockTouched(state, tree, line, touched))
      .map((line) => lineModel(state, tree, line));
    if (models.length === 0) return null;
    const all = models.every((model) => model.quoteEnd > 0);
    const specs: ChangeSpec[] = all
      ? models.map(({ line }) => {
          const mark = line.text.indexOf(">");
          return { from: line.from, to: line.from + mark + 1 + (line.text[mark + 1] === " " ? 1 : 0) };
        })
      : models.filter((model) => model.quoteEnd === 0).map(({ line }) => ({ from: line.from, insert: "> " }));
    const changes = state.changes(specs);
    return { changes, selection: state.selection.map(changes, 1) };
  },
  isActive: (state) => {
    const pos = state.selection.main.head;
    const tree = treeUpTo(state, state.doc.lineAt(pos).to);
    for (const side of [1, -1] as const) {
      for (const node of ancestors(tree, pos, side)) if (node.name === "Blockquote") return true;
    }
    return false;
  },
});
