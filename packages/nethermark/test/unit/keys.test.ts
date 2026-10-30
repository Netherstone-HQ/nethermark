import { describe, expect, test } from "vitest";
import { formatKeys } from "../../src/toolbar/keys.js";

describe("keys in tooltips", () => {
  test.each([
    ["Mod-b", "⌘B", "Ctrl+B"],
    ["Mod-Shift-x", "⇧⌘X", "Ctrl+Shift+X"],
    ["Mod-Alt-1", "⌥⌘1", "Ctrl+Alt+1"],
    ["Mod-Shift-.", "⇧⌘.", "Ctrl+Shift+."],
    ["Shift-Enter", "⇧Enter", "Shift+Enter"],
    ["Ctrl-Alt-z", "⌃⌥Z", "Ctrl+Alt+Z"],
    ["Mod--", "⌘-", "Ctrl+-"],
  ])("%s", (keys, mac, other) => {
    expect(formatKeys(keys, true)).toBe(mac);
    expect(formatKeys(keys, false)).toBe(other);
  });
});
