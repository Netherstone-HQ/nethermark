import { EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { describe, expect, test } from "vitest";
import { defineCommand, markdownEditor } from "../../src/index.js";
import { highlightSyntax } from "../highlight-syntax.js";
import { run, stateOf } from "../notation.js";

const highlight = defineCommand({ inline: { mark: "==", node: "Highlight" } });
const syntax = [highlightSyntax];

describe("inline kind", () => {
  test.each([
    // The inline rules, as bold has them.
    ["⟦word⟧", "==⟦word⟧=="],
    ["==wo‸rd==", "⟦word⟧"],
    ["wo‸rd", "==wo‸rd=="],
    ["a ⟦b⟧ c", "a ==⟦b⟧== c"],
    ["⟦a ==b⟧ c==", "==⟦a b c⟧=="],
    ["⟦a\n\nb⟧", "==⟦a==\n\n==b⟧=="],
    ["a ‸ b", "a ==‸== b"],
    ["a ==‸== b", "a ‸ b"],
    ["`co‸de`", null],
  ])("%j → %j", (before, after) => {
    expect(run(highlight, before, { syntax })).toBe(after);
  });

  test("is active in its node", () => {
    expect(highlight.isActive?.(stateOf("==a‸==", { syntax }))).toBe(true);
    expect(highlight.isActive?.(stateOf("a‸", { syntax }))).toBe(false);
  });

  test("needs its marker", () => {
    expect(() => defineCommand({ inline: { mark: "", node: "Highlight" } })).toThrow(/marker/);
  });
});

describe("line kind", () => {
  const note = defineCommand({ line: { prefix: "%% " } });
  test.each([
    ["te‸xt", "%% te‸xt"],
    ["%% te‸xt", "te‸xt"],
    ["⟦a\n%% b⟧", "%% ⟦a\n%% b⟧"],
    ["⟦%% a\n%% b⟧", "⟦a\nb⟧"],
    ["⟦a\n\nb⟧", "%% ⟦a\n\n%% b⟧"],
    ["> te‸xt", "> %% te‸xt"],
    ["```\nco‸de\n```", null],
  ])("%j → %j", (before, after) => {
    expect(run(note, before)).toBe(after);
  });

  test("is active on a line with the prefix", () => {
    expect(note.isActive?.(stateOf("%% a‸"))).toBe(true);
    expect(note.isActive?.(stateOf("a‸"))).toBe(false);
  });
});

describe("fence kind", () => {
  const mermaid = defineCommand({ fence: "mermaid" });
  test.each([
    ["graph‸", "```mermaid\ngraph‸\n```"],
    ["```mermaid\ngraph‸\n```", "graph‸"],
    // Another fence gets this info string instead.
    ["```js\nx‸\n```", "```mermaid\nx‸\n```"],
    ["```\nx‸\n```", "```mermaid\nx‸\n```"],
  ])("%j → %j", (before, after) => {
    expect(run(mermaid, before)).toBe(after);
  });

  test("is active only in a fence with its info", () => {
    expect(mermaid.isActive?.(stateOf("```mermaid\nx‸\n```"))).toBe(true);
    expect(mermaid.isActive?.(stateOf("```js\nx‸\n```"))).toBe(false);
  });

  test("needs an info string", () => {
    expect(() => defineCommand({ fence: " " })).toThrow(/info string/);
  });
});

describe("block kind", () => {
  const callout = defineCommand({ block: { header: "> [!NOTE]", prefix: "> " } });
  test.each([
    ["No‸te this", "> [!NOTE]\n> No‸te this"],
    ["⟦a\n\nb⟧", "> [!NOTE]\n> ⟦a\n>\n> b⟧"],
    ["> [!NOTE]\n> No‸te this", "No‸te this"],
    ["> [!NOTE]\n> a\n>\n> b‸\n\nafter", "a\n\nb‸\n\nafter"],
    // A plain quote isn't the block.
    ["> quo‸te", "> [!NOTE]\n> > quo‸te"],
  ])("%j → %j", (before, after) => {
    expect(run(callout, before)).toBe(after);
  });

  test("is active in the block", () => {
    expect(callout.isActive?.(stateOf("> [!NOTE]\n> a‸"))).toBe(true);
    expect(callout.isActive?.(stateOf("> a‸"))).toBe(false);
  });
});

test("markdownExtensions reach the editor's parser", () => {
  const state = EditorState.create({ doc: "==a==", extensions: markdownEditor({ markdownExtensions: [highlightSyntax] }) });
  const names: string[] = [];
  syntaxTree(state).iterate({ enter: (node) => void names.push(node.name) });
  expect(names).toContain("Highlight");
  expect(names).toContain("HighlightMark");
});
