import { describe, expect, test } from "vitest";
import { commands } from "../../src/index.js";
import { run } from "../notation.js";

const { hardBreak, footnote, convertToReference, convertToInline, escapeSelection, clearFormatting } = commands;

describe("hard break", () => {
  test.each([
    ["a‸b", "a\\\n‸b"],
    ["a⟦x⟧b", "a\\\n‸b"],
    // Quote markers repeat, and the line lines up with a list item's text.
    ["> a‸", "> a\\\n> ‸"],
    ["- a‸", "- a\\\n  ‸"],
    ["1. a‸", "1. a\\\n   ‸"],
    // A plain line break in code; nothing where a break can't go.
    ["```\na‸\n```", "```\na\n‸\n```"],
    ["# a‸", null],
    ["| a‸ |\n| - |", null],
  ])("%j → %j", (before, after) => {
    expect(run(hardBreak, before)).toBe(after);
  });
});

describe("footnote", () => {
  test.each([
    ["See‸ this.", "See[^1] this.\n\n[^1]: ‸"],
    // Numbered after the last one, next to the other definitions.
    ["A[^1] b‸.\n\n[^1]: one", "A[^1] b[^2].\n\n[^1]: one\n[^2]: ‸"],
    ["A[^note] b‸.\n\n[^note]: one", "A[^note] b[^1].\n\n[^note]: one\n[^1]: ‸"],
    // After other link definitions, a blank line first.
    ["a‸\n\n[r]: http://x", "a[^1]\n\n[r]: http://x\n\n[^1]: ‸"],
    ["‸a ‸b", "[^1]a [^2]b\n\n[^1]: ‸\n[^2]: ‸"],
    ["`co‸de`", null],
  ])("%j → %j", (before, after) => {
    expect(run(footnote, before)).toBe(after);
  });
});

describe("reference links", () => {
  test.each([
    ["[te‸xt](http://x)", "[te‸xt][1]\n\n[1]: http://x"],
    ['[te‸xt](http://x "T")', '[te‸xt][1]\n\n[1]: http://x "T"'],
    ["![a‸lt](p.png)", "![a‸lt][1]\n\n[1]: p.png"],
    // Numbered after the others, next to them; a same destination is used again.
    ["[a][1] [b‸](http://y)\n\n[1]: http://x", "[a][1] [b‸][2]\n\n[1]: http://x\n[2]: http://y"],
    ["[a][1] [b‸](http://x)\n\n[1]: http://x", "[a][1] [b‸][1]\n\n[1]: http://x"],
    ["te‸xt", null],
  ])("to reference: %j", (before, after) => {
    expect(run(convertToReference, before)).toBe(after);
  });

  test.each([
    ["[te‸xt][1]\n\n[1]: http://x", "[te‸xt](http://x)"],
    ['[te‸xt][r]\n\n[r]: http://x "T"', '[te‸xt](http://x "T")'],
    ["[Te‸xt][]\n\n[text]: http://x", "[Te‸xt](http://x)"],
    ["[te‸xt]\n\n[text]: <http://x>", "[te‸xt](<http://x>)"],
    // A definition other links still use stays.
    ["[a‸][1] [b][1]\n\n[1]: http://x", "[a‸](http://x) [b][1]\n\n[1]: http://x"],
    ["[a‸][missing]", null],
    ["[a‸](http://x)", null],
  ])("to inline: %j", (before, after) => {
    expect(run(convertToInline, before)).toBe(after);
  });
});

describe("escape", () => {
  test.each([
    ["⟦a *b* [c]⟧", "⟦a \\*b\\* \\[c\\]⟧"],
    ["⟦# not a heading⟧", "⟦\\# not a heading⟧"],
    ["⟦1. not a list⟧", "⟦1\\. not a list⟧"],
    // A dash mid-line means nothing, so there's nothing to escape.
    ["⟦a - b⟧", null],
    // Escaped already: the backslashes come off.
    ["⟦a \\*b\\*⟧", "⟦a *b*⟧"],
    // Code and URLs are left alone.
    ["⟦`*x*` *y*⟧", "⟦`*x*` \\*y\\*⟧"],
    ["a‸", null],
  ])("%j → %j", (before, after) => {
    expect(run(escapeSelection, before)).toBe(after);
  });
});

describe("clear formatting", () => {
  test.each([
    ["⟦**a** *b* ~~c~~ `d` [e](u)⟧", "⟦a b c d e⟧"],
    ["***a‸***", "a‸"],
    ["x **a‸** y", "x a‸ y"],
    ["⟦a b⟧", null],
  ])("%j → %j", (before, after) => {
    expect(run(clearFormatting, before)).toBe(after);
  });
});
