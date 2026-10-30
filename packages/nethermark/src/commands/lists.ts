import type { ChangeSpec, EditorState, Line } from "@codemirror/state";
import type { SyntaxNode, Tree } from "@lezer/common";
import { defineCommand } from "./command.js";
import { lineModel, lineTransaction, markerGap, touchedLines } from "./line.js";
import { ancestors, children, treeUpTo } from "./tree.js";

/** The list items the touched lines belong to, leaving out those inside another of them. */
function touchedItems(state: EditorState, tree: Tree, lines: readonly Line[]): SyntaxNode[] {
  const items = new Map<number, SyntaxNode>();
  for (const line of lines) {
    if (line.text.trim() === "") continue;
    const model = lineModel(state, tree, line);
    for (const node of ancestors(tree, line.from + model.indentEnd, 1)) {
      if (node.name === "ListItem") {
        items.set(node.from, node);
        break;
      }
    }
  }
  const all = [...items.values()];
  return all.filter((item) => !all.some((other) => other !== item && other.from <= item.from && item.to <= other.to));
}

/** The column, after quote markers, where a list item's marker starts. */
function markerColumn(state: EditorState, tree: Tree, item: SyntaxNode): number {
  const model = lineModel(state, tree, state.doc.lineAt(item.from));
  return model.indentEnd - model.quoteEnd;
}

/** The column, after quote markers, where a list item's text starts: where its children's markers go. */
function contentColumn(state: EditorState, tree: Tree, item: SyntaxNode): number {
  const line = state.doc.lineAt(item.from);
  const model = lineModel(state, tree, line);
  const mark = item.firstChild!;
  const end = mark.to - line.from;
  return end + markerGap(line.text, end) - model.quoteEnd;
}

/** The lines of a list item, with its children. */
function itemLines(state: EditorState, item: SyntaxNode): Line[] {
  const lines: Line[] = [];
  for (let n = state.doc.lineAt(item.from).number; n <= state.doc.lineAt(item.to).number; n++) lines.push(state.doc.line(n));
  return lines;
}

function previousItem(item: SyntaxNode): SyntaxNode | null {
  for (let node = item.prevSibling; node; node = node.prevSibling) if (node.name === "ListItem") return node;
  return null;
}

/**
 * A list command: null outside lists, so Tab moves focus on, and an empty
 * transaction in a list when nothing can move, so Tab stays in the editor.
 */
function nestingCommand(change: (state: EditorState, tree: Tree, item: SyntaxNode) => { specs: ChangeSpec[]; restart?: number }) {
  return defineCommand({
    run: (state) => {
      const lines = touchedLines(state);
      const tree = treeUpTo(state, state.doc.length);
      const items = touchedItems(state, tree, lines);
      if (items.length === 0) return null;
      const results = items.map((item) => change(state, tree, item));
      const specs = results.flatMap((result) => result.specs);
      const restart = results.flatMap((result) => (result.restart === undefined ? [] : [result.restart]));
      const all = items.flatMap((item) => itemLines(state, item));
      return lineTransaction(state, specs, all, restart) ?? {};
    },
  });
}

/** Nests list items under the item before them, with their own children. */
export const indentListCommand = nestingCommand((state, tree, item) => {
  const previous = previousItem(item);
  if (!previous) return { specs: [] };
  const shift = contentColumn(state, tree, previous) - markerColumn(state, tree, item);
  if (shift <= 0) return { specs: [] };
  const specs = itemLines(state, item)
    .filter((line) => line.text.trim() !== "")
    .map((line) => ({ from: line.from + lineModel(state, tree, line).quoteEnd, insert: " ".repeat(shift) }));
  return { specs, restart: item.firstChild!.from };
});

/** Moves list items out to their parent item's level, with their own children. */
export const outdentListCommand = nestingCommand((state, tree, item) => {
  const parent = item.parent?.parent;
  if (parent?.name !== "ListItem") return { specs: [] };
  const shift = markerColumn(state, tree, item) - markerColumn(state, tree, parent);
  const specs: ChangeSpec[] = [];
  for (const line of itemLines(state, item)) {
    const start = lineModel(state, tree, line).quoteEnd;
    let spaces = 0;
    while (spaces < shift && line.text[start + spaces] === " ") spaces++;
    if (spaces > 0) specs.push({ from: line.from + start, to: line.from + start + spaces });
  }
  return { specs };
});

// ── Task done ───────────────────────────────────────────────────────────────

/** The task boxes on the touched lines. */
function taskBoxes(state: EditorState, tree: Tree, lines: readonly Line[]): SyntaxNode[] {
  return lines.flatMap((line) => {
    const model = lineModel(state, tree, line);
    if (model.kind !== "task") return [];
    const box = children(tree.resolveInner(line.from + model.indentEnd, 1).parent!).find((child) => child.name === "Task")?.firstChild;
    return box?.name === "TaskMarker" ? [box] : [];
  });
}

const isDone = (state: EditorState, box: SyntaxNode) => state.sliceDoc(box.from + 1, box.from + 2).toLowerCase() === "x";

/** Ticks the touched tasks, or unticks them when they're all done. */
export const toggleTaskDoneCommand = defineCommand({
  run: (state) => {
    const lines = touchedLines(state);
    const boxes = taskBoxes(state, treeUpTo(state, lines[lines.length - 1]!.to), lines);
    if (boxes.length === 0) return null;
    const allDone = boxes.every((box) => isDone(state, box));
    const changes = boxes
      .filter((box) => isDone(state, box) === allDone)
      .map((box) => ({ from: box.from + 1, to: box.from + 2, insert: allDone ? " " : "x" }));
    return { changes };
  },
  isActive: (state) => {
    const line = state.doc.lineAt(state.selection.main.head);
    const box = taskBoxes(state, treeUpTo(state, line.to), [line])[0];
    return box !== undefined && isDone(state, box);
  },
});
