import { describe, expect, test } from "vitest";
import { commands } from "../../src/index.js";
import { run, stateOf } from "../notation.js";

const { codeBlock, horizontalRule, table, image } = commands;

describe("code block", () => {
  test.each([
    ["co‸de", "```\nco‸de\n```"],
    ["⟦a\nb⟧", "```\n⟦a\nb⟧\n```"],
    ["```\nco‸de\n```", "co‸de"],
    ["```js\na\nb‸\n```\nafter", "a\nb‸\nafter"],
    ["```\nunclosed‸", "unclosed‸"],
    // The fence is longer than any backtick run inside.
    ["a ``` b‸", "````\na ``` b‸\n````"],
    // Quote markers repeat on the fence lines.
    ["> co‸de", "> ```\n> co‸de\n> ```"],
    ["‸", "```\n‸\n```"],
    ["    indented co‸de", null],
  ])("%j → %j", (before, after) => {
    expect(run(codeBlock, before)).toBe(after);
  });

  test("is active in a fenced block", () => {
    expect(codeBlock.isActive?.(stateOf("```\na‸\n```"))).toBe(true);
    expect(codeBlock.isActive?.(stateOf("a‸"))).toBe(false);
  });
});

describe("horizontal rule", () => {
  test.each([
    ["‸", "---‸"],
    ["a\n‸\nb", "a\n\n---‸\n\nb"],
    ["a\n\n‸\n\nb", "a\n\n---‸\n\nb"],
    // After the block the cursor is in, never splitting it.
    ["a‸\nb\n\nc", "a\nb\n\n---‸\n\nc"],
    ["a‸\nb", "a\nb\n\n---‸"],
    ["- a‸\n- b\n# c", "- a\n- b\n\n---‸\n\n# c"],
    // Always inserts.
    ["---‸", "---\n\n---‸"],
  ])("%j → %j", (before, after) => {
    expect(run(horizontalRule, before)).toBe(after);
  });
});

describe("table", () => {
  test.each([
    ["‸", "| ⟦Column 1⟧ | Column 2 |\n| --- | --- |\n|  |  |"],
    ["te‸xt", "text\n\n| ⟦Column 1⟧ | Column 2 |\n| --- | --- |\n|  |  |"],
  ])("%j → %j", (before, after) => {
    expect(run(table, before)).toBe(after);
  });
});

describe("image", () => {
  test.each([
    ["a ‸", "a ![⟦alt⟧](url)"],
    ["⟦a cat⟧", "![a cat](⟦url⟧)"],
    ["`co‸de`", null],
  ])("%j → %j", (before, after) => {
    expect(run(image, before)).toBe(after);
  });
});

describe("insert commands have no active state", () => {
  test.each([horizontalRule, table, image])("%#", (command) => {
    expect(command.isActive).toBeUndefined();
  });
});
