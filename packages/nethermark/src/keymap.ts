import { Prec, type Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { commands, type CommandName } from "./commands/index.js";

/** Keys for each command, in CodeMirror's format, or false for none. */
export type Shortcuts = Partial<Record<CommandName, readonly string[] | false>>;

/** The keys each command has unless a host changes them. */
export const defaultShortcuts: Readonly<Record<CommandName, readonly string[]>> = {
  bold: ["Mod-b"],
  italic: ["Mod-i"],
  strikethrough: ["Mod-Shift-x"],
  inlineCode: ["Mod-e"],
  link: ["Mod-k"],
  heading1: ["Mod-Alt-1"],
  heading2: ["Mod-Alt-2"],
  heading3: ["Mod-Alt-3"],
  heading4: ["Mod-Alt-4"],
  heading5: ["Mod-Alt-5"],
  heading6: ["Mod-Alt-6"],
  paragraph: ["Mod-Alt-0"],
  bulletList: ["Mod-Shift-8"],
  orderedList: ["Mod-Shift-7"],
  taskList: ["Mod-Shift-9"],
  quote: ["Mod-Shift-."],
  codeBlock: ["Mod-Alt-8"],
  horizontalRule: [],
  table: [],
  image: [],
};

/** The keys each command ends up with: the defaults, with a host's changes on top. */
export function resolveShortcuts(overrides: Shortcuts = {}): Record<CommandName, readonly string[]> {
  const resolved = { ...defaultShortcuts };
  for (const name of Object.keys(overrides) as CommandName[]) {
    const keys = overrides[name];
    if (keys !== undefined && name in resolved) resolved[name] = keys === false ? [] : keys;
  }
  return resolved;
}

/**
 * The formatting key bindings, ahead of CodeMirror's own so Mod-I means
 * italic rather than selecting the parent syntax node.
 */
export function formattingKeymap(overrides?: Shortcuts): Extension {
  const resolved = resolveShortcuts(overrides);
  return Prec.high(
    keymap.of(
      (Object.keys(resolved) as CommandName[]).flatMap((name) =>
        resolved[name].map((key) => ({ key, run: commands[name], preventDefault: true })),
      ),
    ),
  );
}
