import { describe, expect, test } from "vitest";
import { commands } from "../../src/index.js";
import { run, stateOf } from "../notation.js";

const { bold, italic, strikethrough, inlineCode, link } = commands;

describe("bold", () => {
  test.each([
    // 1. Inside bold, the markers come off and the text stays selected.
    ["**b‸old**", "⟦bold⟧"],
    ["**⟦bold⟧**", "⟦bold⟧"],
    ["⟦**bold**⟧", "⟦bold⟧"],
    ["__b‸old__", "⟦bold⟧"],
    ["**two wo‸rds**", "⟦two words⟧"],
    // 2. Selected text is wrapped, spaces stay outside.
    ["a ⟦bold⟧ c", "a **⟦bold⟧** c"],
    ["a⟦ bold ⟧c", "a **⟦bold⟧** c"],
    ["⟦‸bold⟧", "**⟦‸bold⟧**"],
    // 3. Partly bold becomes all bold.
    ["⟦a **b⟧ c**", "**⟦a b c⟧**"],
    ["⟦a **b** c⟧", "**⟦a b c⟧**"],
    // 4. A cursor in or at a word formats the word.
    ["wo‸rd", "**wo‸rd**"],
    ["word‸ x", "**word‸** x"],
    ["‸word", "**‸word**"],
    // A cursor at another format's edge formats all of it, and never splits a URL.
    ["*it*‸ x", "***it*‸** x"],
    ["https://exa‸mple.com", "**https://exa‸mple.com**"],
    // 5. A cursor elsewhere inserts a pair, and a second run takes it off.
    ["a ‸ b", "a **‸** b"],
    ["a **‸** b", "a ‸ b"],
    ["‸", "**‸**"],
    // In a line's block syntax, the format goes where the text starts.
    ["‸- item", "- **‸item**"],
    ["‸# Title", "# **‸Title**"],
    ["Title\n‸===", null],
    ["‸~~~\ncode\n~~~", null],
    ["**‸**", "‸"],
    ["***‸***", "*‸*"],
    ["*‸*", "***‸***"],
    ["**~~‸~~**", "~~‸~~"],
    // 6. Across a paragraph break, each paragraph gets its own pair.
    ["⟦a\n\nb⟧", "**⟦a**\n\n**b⟧**"],
    ["⟦a\nb⟧", "**⟦a\nb⟧**"],
    ["# ⟦H\n\np⟧", "# **⟦H**\n\n**p⟧**"],
    ["**⟦a**\n\n**b⟧**", "⟦a\n\nb⟧"],
    ["| ⟦a | b⟧ |\n| - | - |", "| **⟦a** | **b⟧** |\n| - | - |"],
    // 7. Nothing happens in code.
    ["`co‸de`", null],
    ["```\nco‸de\n```", null],
    ["[t](ur‸l)", null],
    // Multiple ranges.
    ["‸a b‸", "**‸a** **b‸**"],
  ])("%j → %j", (before, after) => {
    expect(run(bold, before)).toBe(after);
  });
});

describe("italic and strikethrough", () => {
  test.each([
    ["*i‸t*", italic, "⟦it⟧"],
    ["_i‸t_", italic, "⟦it⟧"],
    ["⟦it⟧", italic, "*⟦it⟧*"],
    ["**b‸**", italic, "***b‸***"],
    ["**‸**", italic, "***‸***"],
    ["~~s‸~~", strikethrough, "⟦s⟧"],
    ["⟦s⟧", strikethrough, "~~⟦s⟧~~"],
    ["~~‸~~", strikethrough, "‸"],
    ["`x‸`", strikethrough, null],
  ])("%j", (before, command, after) => {
    expect(run(command, before)).toBe(after);
  });
});

describe("inline code", () => {
  test.each([
    ["`co‸de`", "⟦code⟧"],
    ["⟦code⟧", "`⟦code⟧`"],
    // 8. Text with backticks gets a longer fence, and padding when it starts or ends with one.
    ["⟦a`b⟧", "``⟦a`b⟧``"],
    ["⟦`a⟧", "`` ⟦`a⟧ ``"],
    ["`` `a‸ ``", "⟦`a⟧"],
    ["‸", "`‸`"],
    ["`‸`", "‸"],
    ["```\nco‸de\n```", null],
  ])("%j → %j", (before, after) => {
    expect(run(inlineCode, before)).toBe(after);
  });
});

describe("link", () => {
  test.each([
    // 9. Selected text links, with the URL ready to type.
    ["⟦text⟧", "[text](⟦url⟧)"],
    ["⟦‸text⟧", "[text](⟦‸url⟧)"],
    ["wo‸rd", "[word](⟦url⟧)"],
    ["a ‸ b", "a [‸]() b"],
    // A selected URL becomes the destination.
    ["⟦https://example.com⟧", "[‸](https://example.com)"],
    // A cursor in a bare URL makes it an autolink, and back.
    ["https://exa‸mple.com", "<https://exa‸mple.com>"],
    ["<https://exa‸mple.com>", "https://exa‸mple.com"],
    // Inside a link, the link comes off and the text stays.
    ["[te‸xt](https://x.y)", "te‸xt"],
    ["[text](⟦url⟧)", "⟦text⟧"],
    ["[‸](https://x.y)", "⟦https://x.y⟧"],
    ["[‸]()", "‸"],
    ["[te‸xt][ref]\n\n[ref]: https://x.y", "te‸xt\n\n[ref]: https://x.y"],
    ["`co‸de`", null],
    // Across paragraphs, each part links and a second run takes them all off.
    ["⟦a\n\nb⟧", "[⟦a](url)\n\n[b⟧](url)"],
    ["[⟦a](url)\n\n[b⟧](url)", "⟦a\n\nb⟧"],
    // A selection over a link makes one link of it all.
    ["⟦see [this](https://x.y) now⟧", "[see this now](⟦url⟧)"],
    // Never inside a backslash break.
    ["a\\‸\nb", "[a](⟦url⟧)\\\nb"],
  ])("%j → %j", (before, after) => {
    expect(run(link, before)).toBe(after);
  });
});

describe("in task items", () => {
  test.each([
    ["- [ ] ta‸sk", bold, "- [ ] **ta‸sk**"],
    ["- [ ] ⟦task⟧", italic, "- [ ] *⟦task⟧*"],
    ["‸- [ ] task", inlineCode, "- [ ] `‸task`"],
    ["- [ ] ta‸sk", link, "- [ ] [task](⟦url⟧)"],
  ])("%j", (before, command, after) => {
    expect(run(command, before)).toBe(after);
  });
});

describe("active state", () => {
  test.each([
    ["**b‸**", bold, true],
    ["b‸", bold, false],
    ["**‸**", bold, true],
    ["`c‸`", inlineCode, true],
    ["`c‸`", bold, false],
    ["[t‸](u)", link, true],
  ])("%j", (doc, command, active) => {
    expect(command.isActive?.(stateOf(doc))).toBe(active);
  });
});
