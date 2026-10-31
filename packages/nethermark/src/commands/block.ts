import { EditorSelection, type ChangeSpec, type EditorState, type Line, type SelectionRange } from "@codemirror/state";
import type { SyntaxNode, Tree } from "@lezer/common";
import { defineCommand, type MarkdownCommand } from "./command.js";
import { fillLabel, labelsFacet } from "../labels.js";
import { ancestorNamed, CODE, longestBacktickRun, treeForSelection, treeUpTo } from "./tree.js";

/** The shortest fence CommonMark allows. */
const MIN_FENCE = 3;

const FENCED = new Set(["FencedCode"]);

/** The fenced block around the range's head, if any. */
function fencedAt(tree: Tree, range: SelectionRange): SyntaxNode | null {
  return ancestorNamed(tree, range.head, FENCED, 1) ?? ancestorNamed(tree, range.head, FENCED, -1);
}

/** The changes that take a fenced block's fence lines away and keep its code. */
function unfence(state: EditorState, block: SyntaxNode): ChangeSpec[] {
  const open = state.doc.lineAt(block.from);
  const close = state.doc.lineAt(block.to);
  const closed = close.number > open.number && block.lastChild?.name === "CodeMark" && block.lastChild.from >= close.from;
  const changes: ChangeSpec[] = [{ from: open.from, to: Math.min(open.to + 1, state.doc.length) }];
  if (closed) changes.push({ from: close.from - 1, to: close.to });
  return changes;
}

/**
 * The lines from the range's first to its last line. A range ending at a
 * line's start leaves that line out.
 */
function lineSpan(state: EditorState, range: SelectionRange) {
  const first = state.doc.lineAt(range.from);
  let last = state.doc.lineAt(range.to);
  if (!range.empty && last.number > first.number && last.from === range.to) last = state.doc.line(last.number - 1);
  return { first, last };
}

/** The quote markers and indentation at the start of a line, which a fence line repeats. */
function containerPrefix(text: string): string {
  return /^[ \t>]*/.exec(text)?.[0] ?? "";
}

/** Wraps the lines a range touches in a fence longer than any backtick run in them, with an info string. */
function fence(state: EditorState, range: SelectionRange, info: string) {
  const { first, last } = lineSpan(state, range);
  const fence = "`".repeat(Math.max(MIN_FENCE, longestBacktickRun(state.sliceDoc(first.from, last.to)) + 1));
  const prefix = containerPrefix(first.text);
  const changes = state.changes([
    { from: first.from, insert: prefix + fence + info + state.lineBreak },
    { from: last.to, insert: state.lineBreak + prefix + fence },
  ]);
  // The code starts after the opening fence and its line break, which is
  // one position whatever the line break's text.
  const codeStart = first.from + prefix.length + fence.length + info.length + 1;
  const map = (pos: number) => (pos === first.from ? codeStart : changes.mapPos(pos, -1));
  return { changes, range: EditorSelection.range(map(range.anchor), map(range.head)) };
}

/** Whether any line a range touches is code already, such as indented code. */
function inCode(state: EditorState, tree: Tree, range: SelectionRange): boolean {
  const { first, last } = lineSpan(state, range);
  for (let n = first.number; n <= last.number; n++) {
    const line = state.doc.line(n);
    const start = line.from + (line.text.length - line.text.trimStart().length);
    if (ancestorNamed(tree, start, CODE, 1) || ancestorNamed(tree, line.to, CODE, -1)) return true;
  }
  return false;
}

/** A fenced block's info string, such as `js`, or nothing. */
function infoOf(state: EditorState, block: SyntaxNode): string {
  const info = block.getChild("CodeInfo");
  return info ? state.sliceDoc(info.from, info.to) : "";
}

/** The change that gives a fenced block another info string. */
function setInfo(block: SyntaxNode, info: string): ChangeSpec {
  const current = block.getChild("CodeInfo");
  if (current) return { from: current.from, to: current.to, insert: info };
  return { from: block.firstChild!.to, insert: info };
}

/**
 * A fence command. With no info string it's codeBlock: it fences the
 * touched lines, or takes any fence off. With one, such as `mermaid`, it
 * takes off only a fence with that info, and gives another fence that info.
 */
export function fenceCommand(info = ""): MarkdownCommand {
  return defineCommand({
    run: (state) => {
      const tree = treeForSelection(state);
      const done = new Set<number>();
      const result = state.changeByRange((range) => {
        const block = fencedAt(tree, range);
        if (block) {
          if (done.has(block.from)) return { range };
          done.add(block.from);
          const own = info === "" || infoOf(state, block) === info;
          const changes = state.changes(own ? unfence(state, block) : setInfo(block, info));
          return { changes, range: range.map(changes, 1) };
        }
        if (inCode(state, tree, range)) return { range };
        return fence(state, range, info);
      });
      return result.changes.empty ? null : result;
    },
    isActive: (state) => {
      const tree = treeUpTo(state, state.doc.lineAt(state.selection.main.head).to);
      const block = fencedAt(tree, state.selection.main);
      return block !== null && (info === "" || infoOf(state, block) === info);
    },
  });
}

export const codeBlockCommand = fenceCommand();

// ── A host's own blocks ─────────────────────────────────────────────────────

/**
 * The block around a line: a header line, like a callout's `> [!NOTE]`, and
 * the lines after it that start with the prefix. Null if the line isn't in one.
 */
function blockAround(state: EditorState, line: Line, header: string, prefix: string): { header: Line; last: Line } | null {
  const mark = prefix.trimEnd();
  const isHeader = (l: Line) => l.text.trimEnd() === header.trimEnd();
  let top: Line | null = null;
  for (let n = line.number; n >= 1; n--) {
    const at = state.doc.line(n);
    if (isHeader(at)) {
      top = at;
      break;
    }
    if (!at.text.startsWith(mark)) return null;
  }
  if (!top) return null;
  let last = top;
  while (last.number < state.doc.lines) {
    const next = state.doc.line(last.number + 1);
    if (!next.text.startsWith(mark) || isHeader(next)) break;
    last = next;
  }
  return { header: top, last };
}

/**
 * A command for a host's own block, such as a callout: a header line, then
 * every line with a prefix. It wraps the touched lines, and in such a block
 * takes the header and prefixes off.
 */
export function blockCommand({ header, prefix }: { header: string; prefix: string }): MarkdownCommand {
  if (!header.trim()) throw new RangeError('A block needs a header line, like "> [!NOTE]".');
  const mark = prefix.trimEnd();
  return defineCommand({
    run: (state) => {
      const done = new Set<number>();
      const result = state.changeByRange((range) => {
        const found = blockAround(state, state.doc.lineAt(range.head), header, prefix);
        if (found) {
          if (done.has(found.header.from)) return { range };
          done.add(found.header.from);
          const specs: ChangeSpec[] = [{ from: found.header.from, to: Math.min(found.header.to + 1, state.doc.length) }];
          for (let n = found.header.number + 1; n <= found.last.number; n++) {
            const line = state.doc.line(n);
            specs.push({ from: line.from, to: line.from + (line.text.startsWith(prefix) ? prefix.length : mark.length) });
          }
          const changes = state.changes(specs);
          return { changes, range: range.map(changes, 1) };
        }
        const { first, last } = lineSpan(state, range);
        const specs: ChangeSpec[] = [{ from: first.from, insert: header + state.lineBreak }];
        for (let n = first.number; n <= last.number; n++) {
          const line = state.doc.line(n);
          // A blank line stays in the block with the bare marker.
          specs.push({ from: line.from, insert: line.text.trim() === "" ? mark : prefix });
        }
        const changes = state.changes(specs);
        return { changes, range: range.map(changes, 1) };
      });
      return result.changes.empty ? null : result;
    },
    isActive: (state) => blockAround(state, state.doc.lineAt(state.selection.main.head), header, prefix) !== null,
  });
}

// ── Inserting blocks ────────────────────────────────────────────────────────

const isBlank = (text: string) => text.trim() === "";

/**
 * Inserts lines as a block of their own, with blank lines around it: on the
 * cursor's line when it's blank, otherwise after the top-level block the
 * cursor is in, so a paragraph or list is never split. Returns the changes
 * and where the inserted text starts.
 */
function insertBlock(state: EditorState, tree: Tree, pos: number, lines: readonly string[]) {
  const breaks = (count: number) => state.lineBreak.repeat(count);
  const block = lines.join(state.lineBreak);
  const line = state.doc.lineAt(pos);
  const before = line.number > 1 ? state.doc.line(line.number - 1) : null;
  // Positions count each line break as one, whatever its text.
  if (isBlank(line.text)) {
    const after = line.number < state.doc.lines ? state.doc.line(line.number + 1) : null;
    const lead = before && !isBlank(before.text) ? 1 : 0;
    const trail = after && !isBlank(after.text) ? 1 : 0;
    return {
      changes: state.changes({ from: line.from, to: line.to, insert: breaks(lead) + block + breaks(trail) }),
      start: line.from + lead,
    };
  }
  let top: SyntaxNode = tree.resolveInner(line.from + (line.text.length - line.text.trimStart().length), 1);
  while (top.parent && top.parent.name !== "Document") top = top.parent;
  const end = state.doc.lineAt(Math.max(top.to, line.to));
  const after = end.number < state.doc.lines ? state.doc.line(end.number + 1) : null;
  const trail = after && !isBlank(after.text) ? 1 : 0;
  return { changes: state.changes({ from: end.to, insert: breaks(2) + block + breaks(trail) }), start: end.to + 2 };
}

export const horizontalRuleCommand = defineCommand({
  run: (state) => {
    const tree = treeUpTo(state, state.doc.length);
    return state.changeByRange((range) => {
      const { changes, start } = insertBlock(state, tree, range.head, ["---"]);
      return { changes, range: EditorSelection.cursor(start + "---".length) };
    });
  },
});

export const tableCommand = defineCommand({
  run: (state) => {
    const tree = treeUpTo(state, state.doc.length);
    const { tableColumn } = state.facet(labelsFacet);
    const [first, second] = [1, 2].map((n) => fillLabel(tableColumn, { n })) as [string, string];
    return state.changeByRange((range) => {
      const { changes, start } = insertBlock(state, tree, range.head, [`| ${first} | ${second} |`, "| --- | --- |", "|  |  |"]);
      const cell = start + "| ".length;
      return { changes, range: EditorSelection.range(cell, cell + first.length) };
    });
  },
});

export const imageCommand = defineCommand({
  run: (state) => {
    const tree = treeForSelection(state);
    const { imageAlt, url } = state.facet(labelsFacet);
    const result = state.changeByRange((range) => {
      if (ancestorNamed(tree, range.head, CODE, 1)) return { range };
      const alt = state.sliceDoc(range.from, range.to).trim();
      const insert = `![${alt || imageAlt}](${url})`;
      const changes = state.changes({ from: range.from, to: range.to, insert });
      const select = alt
        ? { from: range.from + insert.length - url.length - 1, length: url.length }
        : { from: range.from + "![".length, length: imageAlt.length };
      return { changes, range: EditorSelection.range(select.from, select.from + select.length) };
    });
    return result.changes.empty ? null : result;
  },
});
