import { EditorState } from "@codemirror/state";
import { describe, expect, test } from "vitest";
import { commands, defineCommand, markdownEditor } from "../../src/index.js";
import { commandNamed } from "../../src/commands/registry.js";
import { shortcutsFacet } from "../../src/keymap.js";
import { styleDecorations } from "../../src/styles/lines.js";

const shout = defineCommand({ run: (state) => ({ changes: { from: 0, to: state.doc.length, insert: state.doc.toString().toUpperCase() } }) });

const stateWith = (doc: string, options: Parameters<typeof markdownEditor>[0]) =>
  EditorState.create({ doc, extensions: markdownEditor(options) });

describe("markdownEditor", () => {
  test("read-only", () => {
    expect(stateWith("", { readOnly: true }).readOnly).toBe(true);
    expect(stateWith("", {}).readOnly).toBe(false);
  });

  test("a host's commands are found by name, next to the built-in ones", () => {
    const state = stateWith("a", { commands: { shout } });
    expect(commandNamed(state, "shout")).toBe(shout);
    expect(commandNamed(state, "bold")).toBe(commands.bold);
    expect(() => commandNamed(state, "missing")).toThrow(/no command named "missing"/);
  });

  test("shortcuts change keys, can bind a host's command, and ignore unknown names", () => {
    const state = stateWith("", { commands: { shout }, shortcuts: { bold: ["Mod-Shift-b"], shout: ["Mod-u"], nothing: ["Mod-j"] } });
    const keys = state.facet(shortcutsFacet);
    expect(keys.bold).toEqual(["Mod-Shift-b"]);
    expect(keys.shout).toEqual(["Mod-u"]);
    expect(keys.italic).toEqual(["Mod-i"]);
    expect(keys).not.toHaveProperty("nothing");
  });

  test("host classes go on the line kinds next to the package's", () => {
    const state = stateWith("# a", { classNames: { "line-h1": "text-2xl" } });
    const classes: string[] = [];
    styleDecorations(state, [{ from: 0, to: state.doc.length }]).between(0, 3, (_from, _to, deco) => {
      classes.push((deco.spec as { class: string }).class);
    });
    expect(classes).toEqual(["nme-line-h1 text-2xl"]);
  });
});
