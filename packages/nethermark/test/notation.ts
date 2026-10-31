import { EditorSelection, EditorState, Text, type Extension } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import type { MarkdownExtension } from "@lezer/markdown";
import type { MarkdownCommand } from "../src/index.js";

/**
 * Test docs write their selection inline: ‸ is a cursor, ⟦ and ⟧ wrap a
 * range, and a ‸ inside a range marks its head (the head is the end
 * otherwise). None of these characters appear in Markdown, so a doc can use
 * |, [ and ] freely. The first range is the main one.
 */
const CURSOR = "‸";
const OPEN = "⟦";
const CLOSE = "⟧";

export type Notation = { doc: string; selection: EditorSelection };

export function parse(text: string): Notation {
  let doc = "";
  const ranges = [];
  let open: number | null = null;
  let head: number | null = null;
  for (const char of text) {
    if (char === CURSOR) {
      if (open === null) ranges.push(EditorSelection.cursor(doc.length));
      else head = doc.length;
    } else if (char === OPEN) {
      if (open !== null) throw new Error(`Nested ${OPEN} in ${text}`);
      open = doc.length;
    } else if (char === CLOSE) {
      if (open === null) throw new Error(`${CLOSE} without ${OPEN} in ${text}`);
      const close = doc.length;
      ranges.push(head === open ? EditorSelection.range(close, open) : EditorSelection.range(open, close));
      open = null;
      head = null;
    } else {
      doc += char;
    }
  }
  if (open !== null) throw new Error(`${OPEN} without ${CLOSE} in ${text}`);
  if (ranges.length === 0) throw new Error(`No selection in ${text}`);
  return { doc, selection: EditorSelection.create(ranges, 0) };
}

export function print(state: EditorState): string {
  const marks: { pos: number; text: string; order: number }[] = [];
  for (const range of state.selection.ranges) {
    if (range.empty) {
      marks.push({ pos: range.head, text: CURSOR, order: 1 });
    } else {
      marks.push({ pos: range.from, text: OPEN, order: 2 });
      marks.push({ pos: range.to, text: CLOSE, order: 0 });
      if (range.head === range.from) marks.push({ pos: range.from, text: CURSOR, order: 3 });
    }
  }
  marks.sort((a, b) => a.pos - b.pos || a.order - b.order);
  const lines = [...state.doc.iterLines()];
  const stray = lines.find((line) => /[\r\n]/.test(line));
  if (stray !== undefined) throw new Error(`Line break inside a line: ${JSON.stringify(stray)}`);
  const doc = lines.join("\n");
  let out = "";
  let at = 0;
  for (const mark of marks) {
    out += doc.slice(at, mark.pos) + mark.text;
    at = mark.pos;
  }
  return out + doc.slice(at);
}

/**
 * A state with GFM parsing. With `crlf`, the doc's line breaks are CRLF, so
 * a command that inserts a bare "\n" instead of `state.lineBreak` leaves a
 * stray character in a line, which `print` refuses.
 */
export function stateOf(
  text: string,
  { crlf = false, extensions = [] as Extension[], syntax = [] as MarkdownExtension[] } = {},
): EditorState {
  const { doc, selection } = parse(text);
  return EditorState.create({
    doc: Text.of(doc.split("\n")),
    selection,
    extensions: [
      markdown({ base: markdownLanguage, extensions: syntax }),
      EditorState.allowMultipleSelections.of(true),
      crlf ? EditorState.lineSeparator.of("\r\n") : [],
      extensions,
    ],
  });
}

/** Runs a command and prints the result, or null when it doesn't apply. */
export function run(command: MarkdownCommand, text: string, options?: { crlf?: boolean; syntax?: MarkdownExtension[] }): string | null {
  let state = stateOf(text, options);
  const applied = command({ state, dispatch: (tr) => (state = tr.state) });
  return applied ? print(state) : null;
}
