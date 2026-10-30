import { readdirSync, readFileSync } from "node:fs";
import { EditorSelection, EditorState, Text } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { ensureSyntaxTree } from "@codemirror/language";
import { describe, expect, test } from "vitest";
import { commands, type CommandName, type MarkdownCommand } from "../../src/index.js";

/**
 * Every toggling command, run twice, gives the doc back. Paragraph only
 * removes, and horizontal rule, table and image only insert, so they aren't
 * here.
 */
const TOGGLES: CommandName[] = [
  "bold", "italic", "strikethrough", "inlineCode", "link",
  "heading1", "heading2", "heading3", "heading4", "heading5", "heading6",
  "bulletList", "orderedList", "taskList", "quote", "codeBlock",
];

/** The nodes an inline command makes. */
const INLINE_NODES: Partial<Record<CommandName, readonly string[]>> = {
  bold: ["StrongEmphasis"],
  italic: ["Emphasis"],
  strikethrough: ["Strikethrough"],
  inlineCode: ["InlineCode"],
  link: ["Link", "Autolink"],
};

/**
 * Selections where a second run can't give the doc back by design: taking a
 * link off drops its URL, and inline rule 3 merges a partly formatted
 * selection into one format, which a second run can't split back.
 */
function lossy(state: EditorState, name: CommandName): boolean {
  const kinds = INLINE_NODES[name];
  if (!kinds) return false;
  const { from, to } = state.selection.main;
  let found = false;
  ensureSyntaxTree(state, state.doc.length)?.iterate({
    from,
    to,
    enter: (node) => {
      if (!kinds.includes(node.name) || node.to < from || node.from > to) return;
      const holds = node.from <= from && to <= node.to;
      if (name === "link" || (from !== to && !holds && node.from < to && node.to > from)) found = true;
    },
  });
  return found;
}

/** The prefix each line command writes, after any quote markers and indentation. */
const LINE_PREFIXES: Partial<Record<CommandName, RegExp>> = {
  heading1: /^# /, heading2: /^## /, heading3: /^### /, heading4: /^#### /, heading5: /^##### /, heading6: /^###### /,
  bulletList: /^- (?!\[[ xX]\] )/,
  orderedList: /^\d+\. /,
  taskList: /^- \[ \] /,
};

/** Any heading or list prefix. */
const ANY_PREFIX = /^(#{1,6} |[-*+] (\[[ xX]\] )?|\d+[.)] )/;

/**
 * Lines a line command can't give back by design: switching kinds (rule 3)
 * is one way, so `- item` made a heading and back is `item`. Taking a list
 * or heading off also drops what the command wouldn't write again: a task's
 * check, a list's own start number, a Setext underline. So line commands
 * start from plain lines, or from lines in exactly the form they write.
 */
function switchesKind(state: EditorState, name: CommandName): boolean {
  const own = LINE_PREFIXES[name];
  if (!own) return false;
  const { from, to } = state.selection.main;
  for (let n = state.doc.lineAt(from).number; n <= state.doc.lineAt(to).number; n++) {
    const text = state.doc.line(n).text.replace(/^(\s*> ?)*\s*/, "");
    const next = n < state.doc.lines ? state.doc.line(n + 1).text : "";
    if (/^(=+|-+)\s*$/.test(next) && text.trim() !== "") return true;
    if (ANY_PREFIX.test(text) && !own.test(text)) return true;
  }
  return false;
}

/**
 * Quote lines that can't come back: a nested quote loses a level on each
 * run, since every line is quoted (rule 2), and a bare `>` line becomes
 * blank, which quote skips (rule 6).
 */
function nestedOrBareQuote(state: EditorState, name: CommandName): boolean {
  if (name !== "quote") return false;
  const { from, to } = state.selection.main;
  for (let n = state.doc.lineAt(from).number; n <= state.doc.lineAt(to).number; n++) {
    const text = state.doc.line(n).text;
    if (/^\s*>\s*>/.test(text) || /^\s*>\s*$/.test(text)) return true;
  }
  return false;
}

/** Taking a fence off drops its info string and its kind of fence. */
function inFence(state: EditorState, name: CommandName): boolean {
  if (name !== "codeBlock") return false;
  const tree = ensureSyntaxTree(state, state.doc.length);
  const { head } = state.selection.main;
  for (const side of [1, -1] as const) {
    for (let node = tree?.resolveInner(head, side) ?? null; node; node = node.parent) if (node.name === "FencedCode") return true;
  }
  return false;
}

const corpus = new URL("../corpus/", import.meta.url);
const files = readdirSync(corpus).filter((name) => name.endsWith(".md"));

/** Selections to try on each line: its start, middle and end, and the whole line. */
function selections(doc: Text): EditorSelection[] {
  const out: EditorSelection[] = [];
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n);
    if (line.text.trim() === "") continue;
    const middle = line.from + Math.floor(line.length / 2);
    out.push(
      EditorSelection.single(line.from),
      EditorSelection.single(middle),
      EditorSelection.single(line.to),
      EditorSelection.single(line.from, line.to),
    );
  }
  return out;
}

function apply(state: EditorState, command: MarkdownCommand): EditorState | null {
  let next: EditorState | null = null;
  command({ state, dispatch: (tr) => (next = tr.state) });
  return next;
}

/** How many selections each command was checked at, across the corpus. */
const checked = new Map<CommandName, number>();

describe.each(files)("%s", (file) => {
  const doc = readFileSync(new URL(file, corpus), "utf8");
  test.each(TOGGLES)("%s twice gives the doc back", (name) => {
    const base = EditorState.create({ doc, extensions: [markdown({ base: markdownLanguage })] });
    const failures: string[] = [];
    for (const selection of selections(base.doc)) {
      const start = base.update({ selection }).state;
      if (lossy(start, name) || switchesKind(start, name) || nestedOrBareQuote(start, name) || inFence(start, name)) continue;
      const once = apply(start, commands[name]);
      if (!once) continue;
      checked.set(name, (checked.get(name) ?? 0) + 1);
      const twice = apply(once, commands[name]);
      const result = twice ? twice.doc.toString() : once.doc.toString();
      if (result !== doc) {
        const { from, to } = selection.main;
        failures.push(`at ${from}-${to} ${JSON.stringify(base.sliceDoc(base.doc.lineAt(from).from, base.doc.lineAt(from).to))}`);
      }
    }
    expect(failures).toEqual([]);
  });
});

test("every toggle is checked somewhere in the corpus", () => {
  for (const name of TOGGLES) expect(checked.get(name) ?? 0, name).toBeGreaterThan(0);
});
