import { EditorState } from "@codemirror/state";
import { describe, expect, test } from "vitest";
import { commands, defineCommand } from "../../src/index.js";
import { run, stateOf } from "../notation.js";

describe("CRLF line endings", () => {
  test.each([
    ["⟦a\n\nb⟧", commands.bold, "**⟦a**\n\n**b⟧**"],
    ["co‸de", commands.codeBlock, "```\nco‸de\n```"],
    ["```\nco‸de\n```", commands.codeBlock, "co‸de"],
    ["a‸\nb", commands.horizontalRule, "a\nb\n\n---‸"],
    ["‸", commands.table, "| ⟦Column 1⟧ | Column 2 |\n| --- | --- |\n|  |  |"],
    ["⟦a\nb⟧", commands.orderedList, "1. ⟦a\n2. b⟧"],
    ["Ti‸tle\n===", commands.heading2, "## Ti‸tle"],
    ["⟦a\nb⟧", commands.quote, "> ⟦a\n> b⟧"],
  ])("%j", (before, command, after) => {
    expect(run(command, before, { crlf: true })).toBe(after);
  });
});

describe("multiple ranges", () => {
  test.each([
    ["‸a\n\n‸b", commands.heading1, "# ‸a\n\n# ‸b"],
    // b is a lazy line of the first item, so c joins the same list.
    ["‸a\nb\n‸c", commands.orderedList, "1. ‸a\nb\n2. ‸c"],
    ["‸a\n\n‸b", commands.codeBlock, "```\n‸a\n```\n\n```\n‸b\n```"],
    ["```\n‸a\n‸b\n```", commands.codeBlock, "‸a\n‸b"],
    ["‸a b ‸c", commands.inlineCode, "`‸a` b `‸c`"],
    ["‸a\n\n‸b", commands.image, "![⟦alt⟧](url)a\n\n![⟦alt⟧](url)b"],
  ])("%j", (before, command, after) => {
    expect(run(command, before)).toBe(after);
  });
});

describe("defineCommand", () => {
  const upper = defineCommand({
    run: (state) => (state.selection.main.empty ? null : { changes: { from: state.selection.main.from, to: state.selection.main.to, insert: state.sliceDoc(state.selection.main.from, state.selection.main.to).toUpperCase() } }),
    isActive: (state) => state.selection.main.empty,
  });

  test("runs as one transaction", () => {
    expect(run(upper, "⟦ab⟧")).toBe("⟦AB⟧");
  });

  test("returns false when it doesn't apply", () => {
    expect(run(upper, "a‸")).toBeNull();
  });

  test("keeps its active state", () => {
    expect(upper.isActive?.(stateOf("a‸"))).toBe(true);
  });

  test("does nothing in a read-only editor, like every command", () => {
    for (const command of [upper, ...Object.values(commands)]) {
      const state = stateOf("⟦ab⟧", { extensions: [EditorState.readOnly.of(true)] });
      expect(command({ state, dispatch: () => expect.unreachable() })).toBe(false);
    }
  });

  test("the transaction is one undo step marked as formatting", () => {
    let state = stateOf("⟦ab⟧");
    commands.bold({ state, dispatch: (tr) => (state = tr.state, expect(tr.isUserEvent("input.format")).toBe(true)) });
    expect(state.doc.toString()).toBe("**ab**");
  });
});
