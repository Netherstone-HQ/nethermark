import { EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { describe, expect, test } from "vitest";
import { commands } from "../../src/index.js";
import { defaultShortcuts, formattingKeymap, resolveShortcuts } from "../../src/keymap.js";

describe("shortcuts", () => {
  test("every command has an entry", () => {
    expect(Object.keys(defaultShortcuts).sort()).toEqual(Object.keys(commands).sort());
  });

  test("changes replace a command's keys, false removes them, others keep theirs", () => {
    const resolved = resolveShortcuts({ bold: ["Mod-Shift-b"], italic: false });
    expect(resolved.bold).toEqual(["Mod-Shift-b"]);
    expect(resolved.italic).toEqual([]);
    expect(resolved.link).toEqual(["Mod-k"]);
  });

  test("bindings run the commands, and come before CodeMirror's", () => {
    const state = EditorState.create({ extensions: [keymap.of([{ key: "Mod-i", run: () => false }]), formattingKeymap()] });
    const bindings = state.facet(keymap).flat();
    const italic = bindings.findIndex((b) => b.key === "Mod-i" && b.run === commands.italic);
    const other = bindings.findIndex((b) => b.key === "Mod-i" && b.run !== commands.italic);
    expect(italic).toBeGreaterThanOrEqual(0);
    expect(italic).toBeLessThan(other);
  });
});
