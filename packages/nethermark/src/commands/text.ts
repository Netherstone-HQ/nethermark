import { EditorSelection, type ChangeSpec, type EditorState, type Line } from "@codemirror/state";
import type { SyntaxNode, Tree } from "@lezer/common";
import { defineCommand } from "./command.js";
import { CLEARABLE, markerChanges } from "./inline.js";
import { lineModel } from "./line.js";
import { ancestors, BLOCK_CODE, children, CODE, treeForSelection, treeUpTo } from "./tree.js";

function inside(tree: Tree, pos: number, names: ReadonlySet<string>): SyntaxNode | null {
  for (const side of [1, -1] as const) {
    for (const node of ancestors(tree, pos, side)) if (names.has(node.name)) return node;
  }
  return null;
}

// ── Hard break ──────────────────────────────────────────────────────────────

const NO_BREAKS = new Set(["ATXHeading1", "ATXHeading2", "ATXHeading3", "ATXHeading4", "ATXHeading5", "ATXHeading6", "Table"]);

/**
 * A backslash line break. The new line repeats the quote markers and lines
 * up with the text of a list item. In code it's a plain line break, and in
 * a heading or table, which can't hold one, nothing.
 */
export const hardBreakCommand = defineCommand({
  run: (state) => {
    const tree = treeForSelection(state);
    const result = state.changeByRange((range) => {
      if (inside(tree, range.from, NO_BREAKS)) return { range };
      const line = state.doc.lineAt(range.from);
      if (inside(tree, range.from, BLOCK_CODE)) {
        const changes = state.changes({ from: range.from, to: range.to, insert: state.lineBreak });
        return { changes, range: EditorSelection.cursor(range.from + 1) };
      }
      const model = lineModel(state, tree, line);
      const listed = model.kind === "bullet" || model.kind === "ordered" || model.kind === "task";
      const indent = listed ? model.textStart - model.quoteEnd : model.indentEnd - model.quoteEnd;
      const prefix = line.text.slice(0, model.quoteEnd) + " ".repeat(indent);
      const changes = state.changes({ from: range.from, to: range.to, insert: "\\" + state.lineBreak + prefix });
      // The backslash, then one position for the line break.
      return { changes, range: EditorSelection.cursor(range.from + 2 + prefix.length) };
    });
    return result.changes.empty ? null : result;
  },
});

// ── Definitions at the end of the doc ───────────────────────────────────────

const isFootnoteLabel = (label: string) => label.startsWith("[^");

/** The link definitions in the doc, with their labels as written. */
function definitions(state: EditorState, tree: Tree): { node: SyntaxNode; label: string }[] {
  const out: { node: SyntaxNode; label: string }[] = [];
  for (const node of children(tree.topNode)) {
    if (node.name !== "LinkReference") continue;
    const label = node.getChild("LinkLabel");
    if (label) out.push({ node, label: state.sliceDoc(label.from, label.to) });
  }
  return out;
}

/**
 * Where new definitions go: right after the last definition when the doc
 * ends with them, otherwise after a blank line at the end. Returns the
 * insert position and the line breaks that go before the first one.
 */
function definitionSpot(state: EditorState, tree: Tree, footnote: boolean): { pos: number; breaks: number } {
  const end = state.doc.length;
  let last: Line | null = null;
  for (let n = state.doc.lines; n >= 1; n--) {
    const line = state.doc.line(n);
    if (line.text.trim() !== "") {
      last = line;
      break;
    }
  }
  if (!last) return { pos: end, breaks: 0 };
  const defs = definitions(state, tree);
  const lastDef = defs[defs.length - 1];
  const grouped = lastDef && state.doc.lineAt(lastDef.node.to).number === last.number && isFootnoteLabel(lastDef.label) === footnote;
  return { pos: last.to, breaks: grouped ? 1 : 2 };
}

// ── Footnotes ───────────────────────────────────────────────────────────────

/** The highest numbered footnote label in use, in references or definitions. */
function lastFootnote(state: EditorState, tree: Tree): number {
  let max = 0;
  const note = (text: string) => {
    if (!text.startsWith("[^") || !text.endsWith("]")) return;
    const number = Number(text.slice(2, -1));
    if (Number.isInteger(number) && number > max) max = number;
  };
  tree.iterate({
    enter: (ref) => {
      if (ref.name === "LinkLabel" || (ref.name === "Link" && !ref.node.getChild("URL"))) note(state.sliceDoc(ref.from, ref.to));
    },
  });
  return max;
}

/**
 * Inserts `[^n]` after each selection, numbered after the last footnote, and
 * its definition at the end of the doc, with the cursor there to write it.
 */
export const footnoteCommand = defineCommand({
  run: (state) => {
    const tree = treeUpTo(state, state.doc.length);
    if (state.selection.ranges.some((range) => inside(tree, range.to, CODE))) return null;
    const first = lastFootnote(state, tree) + 1;
    const ranges = [...state.selection.ranges].sort((a, b) => a.to - b.to);
    const spot = definitionSpot(state, tree, true);
    const refs = ranges.map((range, i) => ({ from: range.to, insert: `[^${first + i}]` }));
    const defs = ranges.map((_, i) => `[^${first + i}]: `);
    const block = state.lineBreak.repeat(spot.breaks) + defs.join(state.lineBreak);
    const changes = state.changes([...refs, { from: spot.pos, insert: block }]);
    // Each cursor goes to the end of its definition: line breaks count as one position.
    const start = changes.mapPos(spot.pos, -1) + spot.breaks;
    let at = start;
    const cursors = defs.map((def) => {
      at += def.length;
      const cursor = EditorSelection.cursor(at);
      at += 1;
      return cursor;
    });
    return { changes, selection: EditorSelection.create(cursors) };
  },
});

// ── Reference links ─────────────────────────────────────────────────────────

const LINKS = new Set(["Link", "Image"]);

/** A label as CommonMark matches it: case and runs of spaces don't count. */
const normalize = (label: string) => label.slice(1, -1).trim().replace(/\s+/g, " ").toLowerCase();

/** The text part of a link, `[text]` or `![alt]`, up to and with its closing bracket. */
function textEnd(state: EditorState, link: SyntaxNode): number | null {
  const close = children(link).find((child) => child.name === "LinkMark" && state.sliceDoc(child.from, child.to) === "]");
  return close ? close.to : null;
}

/** Turns the inline link at the cursor into a reference link with its definition at the end. */
export const convertToReferenceCommand = defineCommand({
  run: (state) => {
    const tree = treeUpTo(state, state.doc.length);
    const link = inside(tree, state.selection.main.head, LINKS);
    const url = link?.getChild("URL");
    const end = link && textEnd(state, link);
    if (!link || !url || end == null || link.getChild("LinkLabel")) return null;
    const destination = state.sliceDoc(url.from, url.to);
    const titleNode = link.getChild("LinkTitle");
    const title = titleNode ? ` ${state.sliceDoc(titleNode.from, titleNode.to)}` : "";

    // An existing definition of the same destination is used again.
    const defs = definitions(state, tree).filter((def) => !isFootnoteLabel(def.label));
    const same = defs.find(({ node }) => {
      const u = node.getChild("URL");
      const t = node.getChild("LinkTitle");
      return u && state.sliceDoc(u.from, u.to) === destination && (t ? ` ${state.sliceDoc(t.from, t.to)}` : "") === title;
    });
    const numbers = defs.map((def) => Number(def.label.slice(1, -1))).filter((n) => Number.isInteger(n));
    const label = same ? same.label : `[${Math.max(0, ...numbers) + 1}]`;

    const specs: ChangeSpec[] = [{ from: end, to: link.to, insert: label }];
    if (!same) {
      const spot = definitionSpot(state, tree, false);
      specs.push({ from: spot.pos, insert: state.lineBreak.repeat(spot.breaks) + `${label}: ${destination}${title}` });
    }
    const changes = state.changes(specs);
    return { changes, selection: state.selection.map(changes, -1) };
  },
});

/** Turns the reference link at the cursor into an inline link, and drops its definition once nothing else uses it. */
export const convertToInlineCommand = defineCommand({
  run: (state) => {
    const tree = treeUpTo(state, state.doc.length);
    const link = inside(tree, state.selection.main.head, LINKS);
    const end = link && textEnd(state, link);
    if (!link || end == null || link.getChild("URL")) return null;
    const labelNode = link.getChild("LinkLabel");
    const written = labelNode ? state.sliceDoc(labelNode.from, labelNode.to) : "[]";
    const textStart = link.name === "Image" ? link.from + 1 : link.from;
    const label = written === "[]" ? normalize(state.sliceDoc(textStart, end)) : normalize(written);
    const defs = definitions(state, tree).filter((def) => !isFootnoteLabel(def.label));
    const def = defs.find((d) => normalize(d.label) === label);
    const url = def?.node.getChild("URL");
    if (!def || !url) return null;
    const titleNode = def.node.getChild("LinkTitle");
    const title = titleNode ? ` ${state.sliceDoc(titleNode.from, titleNode.to)}` : "";
    const specs: ChangeSpec[] = [{ from: end, to: link.to, insert: `(${state.sliceDoc(url.from, url.to)}${title})` }];

    // The definition goes once this was its only use.
    let uses = 0;
    tree.iterate({
      enter: (ref) => {
        if (!LINKS.has(ref.name) || ref.node.getChild("URL")) return;
        const close = textEnd(state, ref.node);
        const own = ref.node.getChild("LinkLabel");
        const ownText = own ? state.sliceDoc(own.from, own.to) : "[]";
        const start = ref.name === "Image" ? ref.from + 1 : ref.from;
        if (close != null && normalize(ownText === "[]" ? state.sliceDoc(start, close) : ownText) === label) uses++;
      },
    });
    if (uses <= 1) specs.push(definitionRemoval(state, def.node));
    const changes = state.changes(specs);
    return { changes, selection: state.selection.map(changes, -1) };
  },
});

/** Removes a definition's line, and the blank line before it when nothing follows. */
function definitionRemoval(state: EditorState, node: SyntaxNode): ChangeSpec {
  const line = state.doc.lineAt(node.from);
  const last = state.doc.lineAt(node.to);
  const next = last.number < state.doc.lines ? state.doc.line(last.number + 1) : null;
  const before = line.number > 1 ? state.doc.line(line.number - 1) : null;
  if (!before) return { from: line.from, to: Math.min(last.to + 1, state.doc.length) };
  const endsDoc = !next || next.text.trim() === "";
  const blankBefore = before.text.trim() === "" && before.number > 1;
  return { from: endsDoc && blankBefore ? before.from - 1 : line.from - 1, to: last.to };
}

// ── Escape ──────────────────────────────────────────────────────────────────

/** Characters with Markdown meaning anywhere in a line. */
const ALWAYS = new Set(["\\", "`", "*", "_", "[", "]", "<", ">", "|", "~"]);
/** Characters with Markdown meaning at the start of a line's text. */
const AT_START = new Set(["#", "+", "-", "="]);

const UNESCAPED = new Set([...CODE, "URL", "Autolink"]);

/**
 * Backslash-escapes the Markdown characters in the selection, or, when it
 * holds escapes and nothing left to escape, takes the backslashes off.
 * Code and URLs are left alone.
 */
export const escapeSelectionCommand = defineCommand({
  run: (state) => {
    const tree = treeForSelection(state);
    const escapes: ChangeSpec[] = [];
    const unescapes: ChangeSpec[] = [];
    for (const range of state.selection.ranges) {
      if (range.empty) continue;
      tree.iterate({
        from: range.from,
        to: range.to,
        enter: (ref) => {
          if (ref.name === "Escape" && ref.from >= range.from && ref.to <= range.to) unescapes.push({ from: ref.from, to: ref.from + 1 });
        },
      });
      for (let pos = range.from; pos < range.to; pos++) {
        const char = state.sliceDoc(pos, pos + 1);
        const node = tree.resolveInner(pos, 1);
        if (node.name === "Escape" || inside(tree, pos, UNESCAPED)) continue;
        if (ALWAYS.has(char) || (AT_START.has(char) && atTextStart(state, pos)) || ((char === "." || char === ")") && afterLeadingDigits(state, pos))) {
          escapes.push({ from: pos, insert: "\\" });
        }
      }
    }
    const specs = escapes.length > 0 ? escapes : unescapes;
    if (specs.length === 0) return null;
    const changes = state.changes(specs);
    // The selection grows over a backslash added at its start.
    const ranges = state.selection.ranges.map((range) =>
      range.anchor <= range.head
        ? EditorSelection.range(changes.mapPos(range.anchor, -1), changes.mapPos(range.head, 1))
        : EditorSelection.range(changes.mapPos(range.anchor, 1), changes.mapPos(range.head, -1)),
    );
    return { changes, selection: EditorSelection.create(ranges, state.selection.mainIndex) };
  },
});

function atTextStart(state: EditorState, pos: number): boolean {
  const line = state.doc.lineAt(pos);
  return line.text.slice(0, pos - line.from).trim() === "";
}

/** Whether `pos` follows a run of digits that starts a line, as in `1.`. */
function afterLeadingDigits(state: EditorState, pos: number): boolean {
  const line = state.doc.lineAt(pos);
  const before = line.text.slice(0, pos - line.from).trimStart();
  return before.length > 0 && [...before].every((char) => char >= "0" && char <= "9");
}

// ── Clear formatting ────────────────────────────────────────────────────────

/** Takes off every inline format and link the selection touches, or that the cursor is in. */
export const clearFormattingCommand = defineCommand({
  run: (state) => {
    const tree = treeForSelection(state);
    const found = new Map<string, SyntaxNode>();
    for (const range of state.selection.ranges) {
      if (range.empty) {
        for (const node of ancestors(tree, range.head, 0)) if (CLEARABLE.has(node.name)) found.set(`${node.from}:${node.name}`, node);
        continue;
      }
      tree.iterate({
        from: range.from,
        to: range.to,
        enter: (ref) => {
          if (CLEARABLE.has(ref.name) && ref.from < range.to && ref.to > range.from) found.set(`${ref.from}:${ref.name}`, ref.node);
        },
      });
    }
    const specs = [...found.values()].flatMap((node) => markerChanges(state, node));
    if (specs.length === 0) return null;
    const changes = state.changes(specs);
    return { changes, selection: state.selection.map(changes) };
  },
});
