import { ensureSyntaxTree } from "@codemirror/language";
import { highlightTree } from "@lezer/highlight";
import { describe, expect, test } from "vitest";
import { markdownHighlight } from "../../src/styles/highlight.js";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { headingGutter, styleDecorations } from "../../src/styles/lines.js";
import { stateOf } from "../notation.js";

/** The classes on each piece of a doc, as `text: classes`. */
function highlighted(doc: string): string[] {
  const state = stateOf(doc + "‸");
  const out: string[] = [];
  highlightTree(ensureSyntaxTree(state, state.doc.length)!, markdownHighlight, (from, to, classes) => {
    out.push(`${state.sliceDoc(from, to)}: ${classes}`);
  });
  return out;
}

/** The line classes of each line, and the marked text with its class. */
function decorated(doc: string): { lines: string[]; marks: string[] } {
  const state = stateOf(doc + "‸");
  const set = styleDecorations(state, [{ from: 0, to: state.doc.length }]);
  const lines: string[] = Array.from({ length: state.doc.lines }, () => "");
  const marks: string[] = [];
  set.between(0, state.doc.length, (from, to, deco) => {
    const className = (deco.spec as { class: string }).class;
    if (from === to) lines[state.doc.lineAt(from).number - 1] = className;
    else marks.push(`${state.sliceDoc(from, to)}: ${className}`);
  });
  return { lines, marks };
}

describe("syntax classes", () => {
  test.each([
    ["**b**", ["**: nme-strong nme-markup", "b: nme-strong", "**: nme-strong nme-markup"]],
    ["*i*", ["*: nme-em nme-markup", "i: nme-em", "*: nme-em nme-markup"]],
    ["~~s~~", ["~~: nme-strike nme-markup", "s: nme-strike", "~~: nme-strike nme-markup"]],
    // The backticks are markers next to the code, not part of it.
    ["`c`", ["`: nme-markup", "c: nme-code", "`: nme-markup"]],
    ["## H", ["##: nme-heading nme-markup", " H: nme-heading"]],
    ["<!-- c -->", ["<!-- c -->: nme-comment"]],
  ])("%j", (doc, expected) => {
    expect(highlighted(doc)).toEqual(expected);
  });

  test("links, URLs and task boxes", () => {
    const pieces = highlighted("[t](http://x) - [ ] a");
    expect(pieces).toContain("t: nme-link");
    expect(pieces).toContain("http://x: nme-link nme-url");
    expect(highlighted("- [ ] a")).toContain("[ ]: nme-task-marker");
  });
});

describe("line kinds", () => {
  test.each([
    ["# a\n## b\nSetext\n===", ["nme-line-h1", "nme-line-h2", "nme-line-h1", "nme-line-h1"]],
    ["> a\n> b", ["nme-line-quote", "nme-line-quote"]],
    ["- a\n- [ ] b\n  more", ["nme-line-list", "nme-line-list nme-line-task", "nme-line-list"]],
    ["```\nx\n```\ntext", ["nme-line-fence", "nme-line-fence", "nme-line-fence", ""]],
    ["| a |\n| - |", ["nme-line-table", "nme-line-table"]],
    ["> - a", ["nme-line-list nme-line-quote"]],
  ])("%j", (doc, lines) => {
    expect(decorated(doc).lines).toEqual(lines);
  });

  test("list markers and table pipes get their own class", () => {
    expect(decorated("- a\n1. b").marks).toEqual(["-: nme-list-marker", "1.: nme-list-marker"]);
    expect(decorated("| a |\n| - |").marks).toEqual(["|: nme-table-border", "|: nme-table-border", "| - |: nme-table-border"]);
  });

  test("only the given ranges are decorated", () => {
    const state = stateOf("# a\n# b\n# c‸");
    const set = styleDecorations(state, [{ from: 4, to: 7 }]);
    const lines: number[] = [];
    set.between(0, state.doc.length, (from) => void lines.push(state.doc.lineAt(from).number));
    expect(lines).toEqual([2]);
  });
});

describe("heading gutter classes", () => {
  test("marks the gutter cell of each heading line with its level", () => {
    const doc = "# One\n\ntext\n\n### Three\n\nSetext\n---\n\n> ## Quoted";
    const state = EditorState.create({ doc, extensions: [markdown(), headingGutter] });
    ensureSyntaxTree(state, state.doc.length);
    const fresh = state.update({}).state;
    const out: string[] = [];
    fresh.field(headingGutter).between(0, fresh.doc.length, (from, _to, marker) => {
      out.push(`${fresh.doc.lineAt(from).number}: ${marker.elementClass}`);
    });
    expect(out).toEqual(["1: nme-gutter-h1", "5: nme-gutter-h3", "7: nme-gutter-h2", "8: nme-gutter-h2", "10: nme-gutter-h2"]);
  });
});
