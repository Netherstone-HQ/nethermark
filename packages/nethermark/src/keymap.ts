import { Facet, Prec, type Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import type { MarkdownCommand } from "./commands/command.js";
import { commands, type CommandName } from "./commands/index.js";

/**
 * Keys for each command, in CodeMirror's format, or false for none. Built-in
 * commands left out keep their defaults; a host's own commands have none
 * unless they're given here.
 */
export type Shortcuts = { readonly [name in CommandName]?: readonly string[] | false } & {
  readonly [name: string]: readonly string[] | false | undefined;
};

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
  indentList: ["Tab"],
  outdentList: ["Shift-Tab"],
  toggleTaskDone: [],
  addRowAbove: [],
  addRowBelow: [],
  addColumnLeft: [],
  addColumnRight: [],
  deleteRow: [],
  deleteColumn: [],
  alignColumnLeft: [],
  alignColumnCenter: [],
  alignColumnRight: [],
  formatTable: [],
  hardBreak: ["Shift-Enter"],
  footnote: [],
  convertToReference: [],
  convertToInline: [],
  escapeSelection: [],
  clearFormatting: [],
};

/**
 * The keys each command ends up with: the defaults, with a host's changes on
 * top. Names that aren't a built-in or a host's command are left out.
 */
export function resolveShortcuts(overrides: Shortcuts = {}, custom: Readonly<Record<string, MarkdownCommand>> = {}): Record<string, readonly string[]> {
  const resolved: Record<string, readonly string[]> = { ...defaultShortcuts };
  for (const name of Object.keys(custom)) resolved[name] ??= [];
  for (const [name, keys] of Object.entries(overrides)) {
    if (keys !== undefined && name in resolved) resolved[name] = keys === false ? [] : keys;
  }
  return resolved;
}

/** The keys each command has in this editor, for tooltips to show. */
export const shortcutsFacet = Facet.define<Record<string, readonly string[]>, Record<string, readonly string[]>>({
  combine: (values) => values[0] ?? { ...defaultShortcuts },
});

/**
 * Commands that hand their key on when they don't apply: Tab outside a list
 * moves focus out of the editor, so keyboard users aren't trapped, and
 * Shift-Enter where a hard break can't go makes a plain new line.
 */
const HANDS_ON = new Set<CommandName>(["indentList", "outdentList", "hardBreak"]);

/**
 * The formatting key bindings, ahead of CodeMirror's own so Mod-I means
 * italic rather than selecting the parent syntax node. The others keep the
 * browser's own action for their keys, such as a bookmark on Mod-B, from
 * running when the command doesn't apply.
 */
export function formattingKeymap(overrides?: Shortcuts, custom: Readonly<Record<string, MarkdownCommand>> = {}): Extension {
  const resolved = resolveShortcuts(overrides, custom);
  const all: Readonly<Record<string, MarkdownCommand>> = { ...commands, ...custom };
  return [
    shortcutsFacet.of(resolved),
    Prec.high(
      keymap.of(
        Object.entries(resolved).flatMap(([name, keys]) =>
          keys.map((key) => ({ key, run: all[name]!, preventDefault: !HANDS_ON.has(name as CommandName) })),
        ),
      ),
    ),
  ];
}
