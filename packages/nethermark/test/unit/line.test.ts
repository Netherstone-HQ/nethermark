import { describe, expect, test } from "vitest";
import { commands } from "../../src/index.js";
import { run, stateOf } from "../notation.js";

const { heading1, heading2, paragraph, bulletList, orderedList, taskList, quote } = commands;

describe("headings", () => {
  test.each([
    ["ti‸tle", heading2, "## ti‸tle"],
    ["## ti‸tle", heading2, "ti‸tle"],
    // 3. Switching level replaces the marker.
    ["## ti‸tle", heading1, "# ti‸tle"],
    // 8. A list item becomes a heading line.
    ["- it‸em", heading1, "# it‸em"],
    ["  - [ ] it‸em", heading1, "# it‸em"],
    // Quote markers stay.
    ["> qu‸ote", heading1, "> # qu‸ote"],
    // 1, 2. Every touched line; mixed lines all get it.
    ["⟦a\n# b⟧", heading1, "# ⟦a\n# b⟧"],
    ["⟦# a\n# b⟧", heading1, "⟦a\nb⟧"],
    // 6. Blank lines are skipped.
    ["⟦a\n\nb⟧", heading1, "# ⟦a\n\n# b⟧"],
    // A Setext heading becomes ATX.
    ["Ti‸tle\n===", heading2, "## Ti‸tle"],
    ["Ti‸tle\n===", heading1, "Ti‸tle"],
    // Code is left alone.
    ["```\nco‸de\n```", heading1, null],
    // A range ending at a line's start leaves that line out.
    ["⟦a\n⟧b", heading1, "# ⟦a\n⟧b"],
    ["‸", heading1, null],
  ])("%j", (before, command, after) => {
    expect(run(command, before)).toBe(after);
  });
});

describe("paragraph", () => {
  test.each([
    ["## ti‸tle", "ti‸tle"],
    ["- it‸em", "it‸em"],
    ["  1. it‸em", "  it‸em"],
    ["> - [x] it‸em", "> it‸em"],
    ["te‸xt", null],
  ])("%j → %j", (before, after) => {
    expect(run(paragraph, before)).toBe(after);
  });
});

describe("lists", () => {
  test.each([
    ["it‸em", bulletList, "- it‸em"],
    ["- it‸em", bulletList, "it‸em"],
    ["* it‸em", bulletList, "it‸em"],
    ["‸item", bulletList, "- ‸item"],
    ["⟦a\nb⟧", bulletList, "- ⟦a\n- b⟧"],
    ["⟦- a\nb⟧", bulletList, "⟦- a\n- b⟧"],
    // 3. Switching kinds replaces the marker.
    ["- it‸em", taskList, "- [ ] it‸em"],
    ["* it‸em", taskList, "* [ ] it‸em"],
    ["- [ ] it‸em", orderedList, "1. it‸em"],
    ["1. it‸em", bulletList, "- it‸em"],
    ["## it‸em", bulletList, "- it‸em"],
    ["- [x] it‸em", taskList, "it‸em"],
    // 4. Indentation is kept.
    ["- a\n  - b‸", taskList, "- a\n  - [ ] b‸"],
    ["- a\n  - b‸", bulletList, "- a\n  b‸"],
    // 7. Quote and list stack.
    ["> it‸em", bulletList, "> - it‸em"],
    ["> - it‸em", bulletList, "> it‸em"],
    // A list item's later lines follow its first line.
    ["⟦- a\n  more⟧", bulletList, "⟦a\n  more⟧"],
    ["- a\n  mo‸re", bulletList, "- a\n  - mo‸re"],
  ])("%j", (before, command, after) => {
    expect(run(command, before)).toBe(after);
  });
});

describe("ordered lists are renumbered", () => {
  test.each([
    ["⟦a\nb\nc⟧", "1. ⟦a\n2. b\n3. c⟧"],
    // Joining a list continues its numbers.
    ["1. a\n2. b\n‸c", "1. a\n2. b\n3. ‸c"],
    // Leaving a list renumbers the items after it.
    ["1. a\n2. ‸b\n3. c\n4. d", "1. a\n‸b\n2. c\n3. d"],
    // A list's own start is kept.
    ["⟦3. a\nb⟧", "⟦3. a\n4. b⟧"],
    ["5) a\n‸b", "5) a\n6) ‸b"],
    // Nested lists count on their own.
    ["1. a\n   1. x\n   ‸y\n2. b", "1. a\n   1. x\n   2. ‸y\n2. b"],
  ])("%j → %j", (before, after) => {
    expect(run(orderedList, before)).toBe(after);
  });
});

describe("quote", () => {
  test.each([
    ["te‸xt", "> te‸xt"],
    ["> te‸xt", "te‸xt"],
    [">te‸xt", "te‸xt"],
    ["⟦a\n> b⟧", "> ⟦a\n> b⟧"],
    ["⟦> a\n>\n> b⟧", "⟦a\n\nb⟧"],
    ["⟦a\n\nb⟧", "> ⟦a\n\n> b⟧"],
    // 7. It only adds or removes the quote marker.
    ["- it‸em", "> - it‸em"],
    ["> > te‸xt", "> te‸xt"],
    ["```\nco‸de\n```", null],
    ["⟦```\ncode\n```⟧", "> ⟦```\n> code\n> ```⟧"],
  ])("%j → %j", (before, after) => {
    expect(run(quote, before)).toBe(after);
  });
});

describe("line active state", () => {
  test.each([
    ["## a‸", heading2, true],
    ["## a‸", heading1, false],
    ["- a\n  mo‸re", bulletList, false],
    ["- a‸\n  more", bulletList, true],
    ["- [ ] a‸", taskList, true],
    ["- [ ] a‸", bulletList, false],
    ["> a\nla‸zy", quote, true],
    ["a‸", paragraph, true],
  ])("%j", (doc, command, active) => {
    expect(command.isActive?.(stateOf(doc))).toBe(active);
  });
});
