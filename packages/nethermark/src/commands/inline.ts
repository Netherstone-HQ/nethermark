import { EditorSelection, type ChangeSpec, type EditorState, type SelectionRange, type TransactionSpec } from "@codemirror/state";
import type { SyntaxNode, Tree } from "@lezer/common";
import { defineCommand, type MarkdownCommand } from "./command.js";
import { ancestors, children, CODE, longestBacktickRun, treeForSelection, treeUpTo } from "./tree.js";

type Range = { from: number; to: number };

/** Leaf blocks that hold inline text. A format never spans two of them. */
const INLINE_BLOCKS = new Set([
  "Paragraph",
  "ATXHeading1", "ATXHeading2", "ATXHeading3", "ATXHeading4", "ATXHeading5", "ATXHeading6",
  "SetextHeading1", "SetextHeading2",
  "TableCell",
  // A task item's text sits in its Task node, after the checkbox.
  "Task",
]);

/** Link destinations, where formatting would break the link. */
const DESTINATIONS = new Set(["Link", "Image", "Autolink", "LinkReference"]);

/** The parsed markers of inline formats. */
const MARKERS = new Set(["EmphasisMark", "StrikethroughMark", "CodeMark", "LinkMark"]);

const isSpace = (char: string) => char === " " || char === "\t" || char === "\n" || char === "\r";

/**
 * The node of one of these kinds that holds the whole range, if any. A
 * cursor at a node's edge counts as in it only with `edges`.
 */
function enclosing(tree: Tree, range: Range, names: ReadonlySet<string>, edges = false): SyntaxNode | null {
  const empty = range.from === range.to;
  for (const side of [1, -1] as const) {
    for (const node of ancestors(tree, range.from, side)) {
      if (!names.has(node.name)) continue;
      const holds = empty && !edges
        ? node.from < range.from && range.to < node.to
        : node.from <= range.from && range.to <= node.to;
      if (holds) return node;
    }
  }
  return null;
}

/** Every node of this kind that overlaps the range. */
function overlapping(tree: Tree, range: Range, name: string): SyntaxNode[] {
  const nodes: SyntaxNode[] = [];
  tree.iterate({
    from: range.from,
    to: range.to,
    enter: (ref) => {
      if (ref.name === name && ref.from < range.to && ref.to > range.from) nodes.push(ref.node);
    },
  });
  return nodes;
}

/** Block-level code, which a cursor at its very end is still in. */
const BLOCK_CODE = new Set([...CODE].filter((name) => name !== "InlineCode"));
const INLINE_CODE = new Set(["InlineCode"]);

/**
 * Whether a fenced block is really an empty pair at the cursor: `~~‸~~`
 * alone on a line parses as a tilde fence.
 */
function isEmptyPairFence(state: EditorState, block: SyntaxNode, range: Range): boolean {
  const line = state.doc.lineAt(block.from);
  if (block.name !== "FencedCode" || range.from < line.from || range.to > line.to) return false;
  const before = state.sliceDoc(Math.max(line.from, block.from), range.from).trim();
  const after = state.sliceDoc(range.to, line.to).trim();
  const mirrored = before === [...after].reverse().join("");
  return before !== "" && mirrored && [...before].every((char) => char === "~" || char === "`");
}

/**
 * Whether the range sits in code, where formats don't apply, or in a link
 * destination, where they'd break the link.
 */
function blocked(state: EditorState, tree: Tree, range: Range, code: ReadonlySet<string>, destinations = true): boolean {
  const block = enclosing(tree, range, BLOCK_CODE, true);
  if (block && !isEmptyPairFence(state, block, range)) return true;
  if (code.has("InlineCode") && enclosing(tree, range, INLINE_CODE)) return true;
  if (!destinations) return false;
  for (const side of [1, -1] as const) {
    for (const node of ancestors(tree, range.from, side)) {
      if (node.name === "URL" && node.parent && DESTINATIONS.has(node.parent.name) && node.from <= range.from && node.to >= range.to) return true;
    }
  }
  return false;
}

/** The range shrunk past spaces at both ends. */
function trim(state: EditorState, range: Range): Range {
  let { from, to } = range;
  while (from < to && isSpace(state.sliceDoc(from, from + 1))) from++;
  while (to > from && isSpace(state.sliceDoc(to - 1, to))) to--;
  return { from, to };
}

/** Where the text of an inline block starts and ends, past heading marks. */
function blockText(state: EditorState, block: SyntaxNode): Range {
  let { from, to } = block;
  const marks = children(block).filter((child) => child.name === "HeaderMark");
  const first = marks[0];
  if (block.name === "Task") {
    const box = block.firstChild;
    if (box?.name === "TaskMarker") from = box.to;
  } else if (block.name.startsWith("ATX")) {
    if (first && first.from === block.from) from = first.to;
    const last = marks[marks.length - 1];
    if (last && last !== first) to = last.from;
  } else if (block.name.startsWith("Setext") && first) {
    to = state.doc.lineAt(first.from).from - 1;
  }
  return { from, to };
}

/**
 * The parts of a range to format: one per inline block it touches, trimmed
 * of spaces, so a format never spans a paragraph break.
 */
function segments(state: EditorState, tree: Tree, range: Range): Range[] {
  const parts: Range[] = [];
  tree.iterate({
    from: range.from,
    to: range.to,
    enter: (ref) => {
      if (!INLINE_BLOCKS.has(ref.name)) return;
      const text = blockText(state, ref.node);
      let part = trim(state, { from: Math.max(range.from, text.from), to: Math.min(range.to, text.to) });
      // A backslash hard break stays outside, or it would escape the closing marker.
      const end = tree.resolveInner(part.to, -1);
      if (end.name === "HardBreak" && end.from < part.to) part = trim(state, { from: part.from, to: end.from });
      if (part.from < part.to) parts.push(part);
      return false;
    },
  });
  return parts;
}

/** The range kept in the same direction, with new ends. */
function sameDirection(range: SelectionRange, from: number, to: number): SelectionRange {
  return range.anchor <= range.head ? EditorSelection.range(from, to) : EditorSelection.range(to, from);
}

type Run = { char: string; from: number; to: number };

/** The characters inline formats are written with. */
const NEST_CHARS = "*_~`";

/** Runs of marker characters next to `pos` on its line, nearest first. */
function runs(state: EditorState, pos: number, dir: -1 | 1, chars: string): Run[] {
  const line = state.doc.lineAt(pos);
  const out: Run[] = [];
  for (let at = pos; dir < 0 ? at > line.from : at < line.to; at += dir) {
    const char = dir < 0 ? state.sliceDoc(at - 1, at) : state.sliceDoc(at, at + 1);
    if (!chars.includes(char)) break;
    const last = out[out.length - 1];
    if (last && last.char === char) {
      if (dir < 0) last.from--;
      else last.to++;
    } else {
      out.push(dir < 0 ? { char, from: at - 1, to: at } : { char, from: at, to: at + 1 });
    }
  }
  return out;
}

/**
 * The empty formats around a cursor, as in `**‸**` or `**~~‸~~**`: marker
 * runs that mirror each other on both sides and that the parser didn't take
 * as markers, since an empty format doesn't parse. Null if there are none.
 */
function emptyNest(state: EditorState, tree: Tree, pos: number): { left: Run[]; right: Run[] } | null {
  const left = runs(state, pos, -1, NEST_CHARS);
  const right = runs(state, pos, 1, NEST_CHARS);
  const parsed = (run: Run) => {
    const node = tree.resolveInner(run.from, 1);
    return MARKERS.has(node.name) && node.parent?.name !== "FencedCode";
  };
  // The nest ends at the first pair of runs that don't mirror each other,
  // or that the parser took as markers of a real format.
  let size = 0;
  for (; size < Math.min(left.length, right.length); size++) {
    const l = left[size]!;
    const r = right[size]!;
    if (l.char !== r.char || l.to - l.from !== r.to - r.from || parsed(l) || parsed(r)) break;
  }
  return size === 0 ? null : { left: left.slice(0, size), right: right.slice(0, size) };
}

type Wrapper = {
  /** The node of an existing format of this kind. */
  readonly node: string;
  /** The changes that take the wrapping off a node. */
  unwrap(state: EditorState, node: SyntaxNode): ChangeSpec[];
  /** The opening and closing text for a part. */
  wrap(state: EditorState, part: Range, without: readonly Range[]): { open: string; close: string };
  /** Whether a run of marker characters around an empty cursor is this format. */
  inNest(run: Run): boolean;
  /** The opening text, as written into an empty nest. */
  readonly mark: string;
  /** Kinds of code it does nothing in. */
  readonly code: ReadonlySet<string>;
};

/** The doc text of a range, leaving out some parts of it. */
function textWithout(state: EditorState, part: Range, without: readonly Range[]): string {
  let text = "";
  let at = part.from;
  for (const cut of [...without].sort((a, b) => a.from - b.from)) {
    if (cut.to <= at || cut.from >= part.to) continue;
    text += state.sliceDoc(at, Math.max(at, cut.from));
    at = Math.max(at, cut.to);
  }
  return text + state.sliceDoc(at, Math.max(at, part.to));
}

function markerWrapper(node: string, markNode: string, mark: string, inNest: (run: Run) => boolean): Wrapper {
  return {
    node,
    mark,
    code: CODE,
    inNest,
    unwrap: (_state, found) => {
      const marks = children(found).filter((child) => child.name === markNode);
      const open = marks[0];
      const close = marks[marks.length - 1];
      if (!open || !close || open === close || open.from !== found.from || close.to !== found.to) return [];
      return [{ from: open.from, to: open.to }, { from: close.from, to: close.to }];
    },
    wrap: () => ({ open: mark, close: mark }),
  };
}

const emphasisChar = (run: Run) => run.char === "*" || run.char === "_";

const bold = markerWrapper("StrongEmphasis", "EmphasisMark", "**", (run) => emphasisChar(run) && run.to - run.from >= 2);
const italic = markerWrapper("Emphasis", "EmphasisMark", "*", (run) => emphasisChar(run) && (run.to - run.from) % 2 === 1);
const strike = markerWrapper("Strikethrough", "StrikethroughMark", "~~", (run) => run.char === "~" && run.to - run.from === 2);

const code: Wrapper = {
  node: "InlineCode",
  mark: "`",
  code: BLOCK_CODE,
  inNest: (run) => run.char === "`",
  unwrap: (state, found) => {
    const marks = children(found).filter((child) => child.name === "CodeMark");
    const open = marks[0];
    const close = marks[marks.length - 1];
    if (!open || !close || open === close) return [];
    const changes: ChangeSpec[] = [{ from: open.from, to: open.to }, { from: close.from, to: close.to }];
    // The padding a longer fence needs around text that starts or ends with
    // a backtick comes off with it.
    const inner = state.sliceDoc(open.to, close.from);
    const content = inner.slice(1, -1);
    if (inner.length > 2 && inner.startsWith(" ") && inner.endsWith(" ") && (content.startsWith("`") || content.endsWith("`"))) {
      changes.push({ from: open.to, to: open.to + 1 }, { from: close.from - 1, to: close.from });
    }
    return changes;
  },
  wrap: (state, part, without) => {
    const text = textWithout(state, part, without);
    const fence = "`".repeat(longestBacktickRun(text) + 1);
    const pad = text.startsWith("`") || text.endsWith("`") ? " " : "";
    return { open: fence + pad, close: pad + fence };
  },
};

/** The markers of every node of this kind in a list, as changes and as ranges. */
function unwrapAll(state: EditorState, wrapper: Wrapper, nodes: readonly SyntaxNode[]) {
  const changes = nodes.flatMap((node) => wrapper.unwrap(state, node));
  const removed = changes.map((change) => change as Range);
  return { changes, removed };
}

/** Formats one selection range. */
function formatRange(state: EditorState, tree: Tree, range: SelectionRange, wrapper: Wrapper) {
  if (blocked(state, tree, range, wrapper.code)) return { range };

  // Inside a node of this kind, or at its edge: take its markers off. From a
  // cursor, the text it held ends up selected, so a second run puts them back.
  const found = enclosing(tree, range, new Set([wrapper.node]), true);
  if (found) {
    const changes = state.changes(wrapper.unwrap(state, found));
    const text = EditorSelection.range(changes.mapPos(found.from, 1), changes.mapPos(found.to, -1));
    const onlyMarkers = [...state.sliceDoc(found.from, found.to)].every((char) => NEST_CHARS.includes(char));
    return { changes, range: range.empty && !onlyMarkers ? text : range.map(changes, 1) };
  }

  if (range.empty) {
    const pos = emptyNest(state, tree, range.head) ? range.head : textPosition(state, tree, range.head);
    return pos === null ? { range } : formatCursor(state, tree, pos, wrapper);
  }

  // Every part already formatted, as after formatting across paragraphs or
  // table cells: take each part's markers off.
  const formatted = segments(state, tree, range).map((part) => enclosing(tree, part, new Set([wrapper.node])));
  if (formatted.length > 1 && formatted.every((node) => node !== null)) {
    const changes = state.changes(formatted.flatMap((node) => wrapper.unwrap(state, node)));
    return { changes, range: range.map(changes, 1) };
  }

  // Partly formatted: take every marker off, then format the whole span.
  const nodes = overlapping(tree, range, wrapper.node);
  const span = nodes.reduce((acc, node) => ({ from: Math.min(acc.from, node.from), to: Math.max(acc.to, node.to) }), {
    from: range.from,
    to: range.to,
  });
  const { changes: unwraps, removed } = unwrapAll(state, wrapper, nodes);
  const parts = segments(state, tree, span);
  if (parts.length === 0) return { range };
  const wraps = parts.flatMap((part) => {
    const { open, close } = wrapper.wrap(state, part, removed);
    return [{ from: part.from, insert: open }, { from: part.to, insert: close }];
  });
  const changes = state.changes([...unwraps, ...wraps]);
  const from = changes.mapPos(parts[0]!.from, 1);
  const to = changes.mapPos(parts[parts.length - 1]!.to, -1);
  return { changes, range: sameDirection(range, from, to) };
}

/** Markers of a line's block syntax, before its text. */
const PREFIX_MARKS = new Set(["QuoteMark", "ListMark", "TaskMarker", "HeaderMark"]);

/** Blocks that hold other blocks, not text of their own. */
const CONTAINERS = new Set(["Document", "Blockquote", "BulletList", "OrderedList", "ListItem"]);

/**
 * Where an inline format at a cursor goes: the cursor itself in a line's
 * text, or the start of the text when the cursor is in the line's block
 * syntax, such as before a list marker. Null on a line with no text, like a
 * fence or a heading underline.
 */
function textPosition(state: EditorState, tree: Tree, pos: number): number | null {
  const line = state.doc.lineAt(pos);
  // Past the line's block syntax: indentation, quote and list markers, task
  // boxes and heading marks.
  let prefixEnd = line.from;
  for (;;) {
    if (state.sliceDoc(prefixEnd, prefixEnd + 1) === " " && prefixEnd < line.to) {
      prefixEnd++;
      continue;
    }
    const node = tree.resolveInner(prefixEnd, 1);
    const headingOpen = node.name === "HeaderMark" && node.parent?.name.startsWith("ATX") && node.parent.from === node.from;
    if (node.from !== prefixEnd || !(PREFIX_MARKS.has(node.name) && (node.name !== "HeaderMark" || headingOpen))) break;
    prefixEnd = node.to;
  }
  pos = Math.max(pos, prefixEnd);
  // Before a backslash escape or hard break, never inside one.
  const escape = tree.resolveInner(pos, -1);
  if ((escape.name === "Escape" || escape.name === "HardBreak") && escape.from < pos) pos = escape.from;

  for (const side of [1, -1] as const) {
    for (const node of ancestors(tree, pos, side)) {
      if (INLINE_BLOCKS.has(node.name)) {
        // In a heading's underline or closing marks, there's no text to format.
        const text = blockText(state, node);
        return text.from <= pos && pos <= text.to ? pos : null;
      }
      // In a block with no inline text, like a fence or a link definition.
      if (!CONTAINERS.has(node.name) && node.parent && CONTAINERS.has(node.parent.name) && !PREFIX_MARKS.has(node.name)) return null;
    }
  }
  // A blank line, or a list item or quote with no text yet, takes a new pair.
  return state.sliceDoc(pos, line.to).trim() === "" ? pos : null;
}

/** Inline nodes a cursor at their edge formats as a whole, like a word. */
const INLINE_UNITS = new Set(["StrongEmphasis", "Emphasis", "Strikethrough", "InlineCode", "Link", "Autolink", "URL"]);

/**
 * What a cursor formats as a word: the outermost format or link it touches,
 * so a new pair never merges with another's markers, or a bare URL, which a
 * format must not split, or else the word itself.
 */
function wordAround(state: EditorState, tree: Tree, pos: number): Range | null {
  let unit: SyntaxNode | null = null;
  for (const side of [1, -1] as const) {
    for (const node of ancestors(tree, pos, side)) {
      if (INLINE_BLOCKS.has(node.name)) break;
      if (!INLINE_UNITS.has(node.name) || node.from > pos || node.to < pos) continue;
      if (node.name === "URL" && node.parent && DESTINATIONS.has(node.parent.name)) continue;
      if (!unit || node.to - node.from > unit.to - unit.from) unit = node;
    }
  }
  return unit ? { from: unit.from, to: unit.to } : state.wordAt(pos);
}

/** Formats at an empty cursor: an empty format, the word, or a new pair. */
function formatCursor(state: EditorState, tree: Tree, pos: number, wrapper: Wrapper) {
  const nest = emptyNest(state, tree, pos);
  if (nest) {
    const index = nest.left.findIndex((run) => wrapper.inNest(run));
    const left = nest.left[index];
    const right = nest.right[index];
    if (left && right) {
      const size = wrapper.mark.length;
      const changes = state.changes([
        { from: left.to - size, to: left.to },
        { from: right.from, to: right.from + size },
      ]);
      return { changes, range: EditorSelection.cursor(changes.mapPos(pos)) };
    }
  }

  const word = nest ? null : wordAround(state, tree, pos);
  if (word) {
    const { open, close } = wrapper.wrap(state, word, []);
    const changes = state.changes([{ from: word.from, insert: open }, { from: word.to, insert: close }]);
    return { changes, range: EditorSelection.cursor(changes.mapPos(pos, pos === word.from ? 1 : -1)) };
  }

  const changes = state.changes({ from: pos, insert: wrapper.mark + wrapper.mark });
  return { changes, range: EditorSelection.cursor(pos + wrapper.mark.length) };
}

function inlineCommand(wrapper: Wrapper): MarkdownCommand {
  return defineCommand({
    run: (state) => {
      const tree = treeForSelection(state);
      const result = state.changeByRange((range) => formatRange(state, tree, range, wrapper));
      return result.changes.empty ? null : result;
    },
    isActive: (state) => {
      const range = state.selection.main;
      const tree = treeUpTo(state, state.doc.lineAt(range.to).to);
      if (blocked(state, tree, range, wrapper.code)) return false;
      if (enclosing(tree, range, new Set([wrapper.node]), true)) return true;
      if (!range.empty) return false;
      return emptyNest(state, tree, range.head)?.left.some((run) => wrapper.inNest(run)) ?? false;
    },
  });
}

export const boldCommand = inlineCommand(bold);
export const italicCommand = inlineCommand(italic);
export const strikethroughCommand = inlineCommand(strike);
export const inlineCodeCommand = inlineCommand(code);

// ── Links ───────────────────────────────────────────────────────────────────

const LINKS = new Set(["Link", "Autolink"]);
const URL_PLACEHOLDER = "url";

/** Takes a link off and keeps its text, or its URL when it has no text. */
function unlink(state: EditorState, link: SyntaxNode, range: SelectionRange) {
  const marks = children(link).filter((child) => child.name === "LinkMark");
  if (link.name === "Autolink") {
    const changes = state.changes(linkMarkers(state, link));
    return { changes, range: range.map(changes, 1) };
  }
  const open = marks[0];
  const close = marks.find((mark) => state.sliceDoc(mark.from, mark.to) === "]");
  if (!open || !close) return { range };
  if (close.from > open.to) {
    const changes = state.changes([
      { from: link.from, to: open.to },
      { from: close.from, to: link.to },
    ]);
    // A selection outside the text, such as on the URL, moves to the text.
    const inText = open.to <= range.from && range.to <= close.from;
    const text = EditorSelection.range(changes.mapPos(open.to, 1), changes.mapPos(close.from, -1));
    return { changes, range: inText ? range.map(changes, 1) : text };
  }
  const url = children(link).find((child) => child.name === "URL");
  const text = url ? state.sliceDoc(url.from, url.to) : "";
  const changes = state.changes({ from: link.from, to: link.to, insert: text });
  return { changes, range: EditorSelection.range(link.from, link.from + text.length) };
}

/** A bare URL the parser found in text, around or exactly at the range. */
function bareUrl(tree: Tree, range: Range): SyntaxNode | null {
  for (const node of ancestors(tree, range.from, 1)) {
    if (node.name !== "URL") continue;
    if (node.parent && DESTINATIONS.has(node.parent.name)) return null;
    if (node.from <= range.from && range.to <= node.to) return node;
  }
  return null;
}

/** The changes that take a link's syntax off and keep its text. */
function linkMarkers(state: EditorState, link: SyntaxNode): ChangeSpec[] {
  const marks = children(link).filter((child) => child.name === "LinkMark");
  if (link.name === "Autolink") return marks.map((mark) => ({ from: mark.from, to: mark.to }));
  const open = marks[0];
  const close = marks.find((mark) => state.sliceDoc(mark.from, mark.to) === "]");
  if (!open || !close) return [];
  return [{ from: link.from, to: open.to }, { from: close.from, to: link.to }];
}

/**
 * `[text](url)` for each part. One part gets its `url` selected for typing;
 * several keep the text selected, so a second run takes them all off.
 */
function linkParts(state: EditorState, parts: readonly Range[], range: SelectionRange, unlinks: ChangeSpec[] = []) {
  const changes = state.changes([
    ...unlinks,
    ...parts.flatMap((part) => [
      { from: part.from, insert: "[" },
      { from: part.to, insert: `](${URL_PLACEHOLDER})` },
    ]),
  ]);
  const first = parts[0]!;
  const last = parts[parts.length - 1]!;
  if (parts.length > 1) return { changes, range: sameDirection(range, changes.mapPos(first.from, 1), changes.mapPos(last.to, -1)) };
  const from = changes.mapPos(last.to, 1) - URL_PLACEHOLDER.length - 1;
  return { changes, range: sameDirection(range, from, from + URL_PLACEHOLDER.length) };
}

function linkRange(state: EditorState, tree: Tree, range: SelectionRange) {
  if (blocked(state, tree, range, CODE, false)) return { range };

  const link = enclosing(tree, range, LINKS);
  if (link) return unlink(state, link, range);

  const url = bareUrl(tree, range);
  if (url && range.empty) {
    // A bare URL with no text becomes an autolink.
    const changes = state.changes([{ from: url.from, insert: "<" }, { from: url.to, insert: ">" }]);
    return { changes, range: range.map(changes, 1) };
  }
  const trimmed = trim(state, range);
  if (url && url.from === trimmed.from && url.to === trimmed.to) {
    // A selected URL becomes the destination, with the cursor where its text goes.
    const changes = state.changes([{ from: url.from, insert: "[](" }, { from: url.to, insert: ")" }]);
    return { changes, range: EditorSelection.cursor(url.from + 1) };
  }

  if (!range.empty) {
    const parts = segments(state, tree, range);
    if (parts.length === 0) return { range };
    // Every part already a link: take them all off.
    const linked = parts.map((part) => enclosing(tree, part, LINKS));
    if (parts.length > 1 && linked.every((node) => node !== null)) {
      const changes = state.changes(linked.flatMap((node) => linkMarkers(state, node)));
      return { changes, range: range.map(changes, 1) };
    }
    // Links can't nest, so links the selection overlaps merge into the new one.
    const inside = [...overlapping(tree, range, "Link"), ...overlapping(tree, range, "Autolink")];
    if (inside.length === 0) return linkParts(state, parts, range);
    const span = inside.reduce<Range>((acc, node) => ({ from: Math.min(acc.from, node.from), to: Math.max(acc.to, node.to) }), range);
    return linkParts(state, segments(state, tree, span), range, inside.flatMap((node) => linkMarkers(state, node)));
  }

  const pos = textPosition(state, tree, range.head);
  if (pos === null) return { range };
  const word = state.wordAt(pos);
  if (word) return linkParts(state, [word], range);

  const changes = state.changes({ from: pos, insert: "[]()" });
  return { changes, range: EditorSelection.cursor(pos + 1) };
}

export const linkCommand = defineCommand({
  run: (state): TransactionSpec | null => {
    const tree = treeForSelection(state);
    const result = state.changeByRange((range) => linkRange(state, tree, range));
    return result.changes.empty ? null : result;
  },
  isActive: (state) => {
    const range = state.selection.main;
    const tree = treeUpTo(state, state.doc.lineAt(range.to).to);
    return enclosing(tree, range, LINKS) !== null;
  },
});
