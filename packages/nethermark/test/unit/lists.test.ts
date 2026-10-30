import { describe, expect, test } from "vitest";
import { commands } from "../../src/index.js";
import { run, stateOf } from "../notation.js";

const { indentList, outdentList, toggleTaskDone } = commands;

describe("indent and outdent", () => {
  test.each([
    ["- a\n- b‸", indentList, "- a\n  - b‸"],
    ["- a\n  - b‸", outdentList, "- a\n- b‸"],
    // Children move with their item.
    ["- a\n- b‸\n  - c", indentList, "- a\n  - b‸\n    - c"],
    ["- a\n  - b‸\n    - c", outdentList, "- a\n- b‸\n  - c"],
    // Under a task or numbered item, the child lines up with its text.
    ["1. a\n2. b‸", indentList, "1. a\n   1. b‸"],
    ["10. a\n11. b‸", indentList, "10. a\n    1. b‸"],
    ["1. a\n   1. b‸\n2. c", outdentList, "1. a\n2. b‸\n3. c"],
    ["1. a\n2. b‸\n3. c", indentList, "1. a\n   1. b‸\n2. c"],
    // Several items at once.
    ["- a\n- ⟦b\n- c⟧", indentList, "- a\n  - ⟦b\n  - c⟧"],
    // In a quote.
    ["> - a\n> - b‸", indentList, "> - a\n>   - b‸"],
    // The first item, or a top-level one, can't move: Tab stays in the editor.
    ["- a‸\n- b", indentList, "- a‸\n- b"],
    ["- a‸", outdentList, "- a‸"],
    // Outside lists the command doesn't apply, so Tab moves focus on.
    ["te‸xt", indentList, null],
    ["te‸xt", outdentList, null],
  ])("%j", (before, command, after) => {
    expect(run(command, before)).toBe(after);
  });
});

describe("task done", () => {
  test.each([
    ["- [ ] a‸", "- [x] a‸"],
    ["- [x] a‸", "- [ ] a‸"],
    ["- [X] a‸", "- [ ] a‸"],
    ["⟦- [x] a\n- [ ] b⟧", "⟦- [x] a\n- [x] b⟧"],
    ["⟦- [x] a\n- [x] b⟧", "⟦- [ ] a\n- [ ] b⟧"],
    ["> - [ ] a‸", "> - [x] a‸"],
    ["- a‸", null],
  ])("%j → %j", (before, after) => {
    expect(run(toggleTaskDone, before)).toBe(after);
  });

  test("is active on a done task", () => {
    expect(toggleTaskDone.isActive?.(stateOf("- [x] a‸"))).toBe(true);
    expect(toggleTaskDone.isActive?.(stateOf("- [ ] a‸"))).toBe(false);
  });
});
