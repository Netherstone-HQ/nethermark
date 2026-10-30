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

  test("Tab, Shift-Tab and Shift-Enter hand their key on when the command doesn't apply", () => {
    const bindings = EditorState.create({ extensions: [formattingKeymap()] }).facet(keymap).flat();
    for (const key of ["Tab", "Shift-Tab", "Shift-Enter"]) {
      expect(bindings.find((b) => b.key === key)?.preventDefault, key).toBe(false);
    }
    expect(bindings.find((b) => b.key === "Mod-b")?.preventDefault).toBe(true);
  });
});
