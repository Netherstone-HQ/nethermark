import { describe, expect, test } from "vitest";
import { parse, print, stateOf } from "../notation.js";

describe("selection notation", () => {
  test.each([
    ["a‸b", "ab", [[1, 1]]],
    ["⟦ab⟧", "ab", [[0, 2]]],
    ["⟦‸ab⟧", "ab", [[2, 0]]],
    ["‸a⟦b⟧", "ab", [[0, 0], [1, 2]]],
    ["[x](u) | ‸", "[x](u) | ", [[9, 9]]],
  ])("%s", (text, doc, ranges) => {
    const parsed = parse(text);
    expect(parsed.doc).toBe(doc);
    expect(parsed.selection.ranges.map((r) => [r.anchor, r.head])).toEqual(ranges);
    expect(print(stateOf(text))).toBe(text);
  });

  test("rejects a doc without a selection", () => {
    expect(() => parse("ab")).toThrow();
  });

  test("CRLF docs count each line break as one position", () => {
    const state = stateOf("a\nb‸", { crlf: true });
    expect(state.lineBreak).toBe("\r\n");
    expect(state.selection.main.head).toBe(3);
    expect(print(state)).toBe("a\nb‸");
  });
});
