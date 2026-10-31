import type { EditorState } from "@codemirror/state";
import type { MarkdownCommand } from "../commands/command.js";
import type { CommandName } from "../commands/index.js";
import { commandNamed } from "../commands/registry.js";
import { inTable } from "../commands/tables.js";
import { defaultLabels, type LabelName } from "../labels.js";
import { icons } from "./icons.js";

/**
 * A button that runs a command. The icon is an SVG string, or plain text,
 * like `H1`, drawn in the UI font.
 */
export type ToolbarButton = {
  /** A command, or the name of one: built in, or the host's own from the `commands` option. */
  readonly command: CommandName | (string & {}) | MarkdownCommand;
  readonly icon: string;
  readonly label: string;
  /** Keys to show in the tooltip, for a host's own command. Built-in commands show the keys they're bound to. */
  readonly shortcut?: readonly string[];
  /** Always in the More menu, never on the bar. */
  readonly inMore?: boolean;
};

/** A button that opens a menu of items. */
export type ToolbarMenu = {
  readonly menu: readonly ToolbarItem[];
  readonly icon: string;
  readonly label: string;
  /** When given, the menu only shows while this is true, as the table menu does in a table. */
  readonly visible?: (state: EditorState) => boolean;
  readonly inMore?: boolean;
};

export type ToolbarItem = ToolbarButton | ToolbarMenu | "separator";

/** A toolbar item, checked: a host's own item follows the same rules as the built-in ones. */
export function defineToolbarItem<T extends ToolbarButton | ToolbarMenu>(item: T): T {
  if (!item.label.trim()) throw new RangeError("A toolbar item needs a label, for its aria-label and tooltip.");
  if (!item.icon.trim()) throw new RangeError(`The toolbar item "${item.label}" needs an icon: an SVG string or text.`);
  return Object.freeze(item);
}

/** The command a button runs in an editor. */
export function commandOf(state: EditorState, button: ToolbarButton): MarkdownCommand {
  return typeof button.command === "string" ? commandNamed(state, button.command) : button.command;
}

export const isMenu = (item: ToolbarItem): item is ToolbarMenu => typeof item === "object" && "menu" in item;

/** The built-in items, with the label each one shows, so the `labels` option reaches them. */
const builtInLabels = new WeakMap<ToolbarButton | ToolbarMenu, LabelName>();

/** The label an item shows: a built-in item's from the editor's labels, a host's own item's as given. */
export function labelOf(item: ToolbarButton | ToolbarMenu, labels: Readonly<Record<LabelName, string>>): string {
  const name = builtInLabels.get(item);
  return name ? labels[name] : item.label;
}

function builtIn<T extends ToolbarButton | ToolbarMenu>(name: LabelName, item: T): T {
  builtInLabels.set(item, name);
  return item;
}

const button = (command: CommandName & LabelName, icon: string, inMore?: boolean): ToolbarButton =>
  builtIn(command, defineToolbarItem({ command, icon, label: defaultLabels[command], ...(inMore && { inMore }) }));

/** The row, column and alignment commands, shown while the cursor is in a table. */
export const tableMenu: ToolbarMenu = builtIn("tableMenu", defineToolbarItem({
  icon: icons.tableMenu,
  label: defaultLabels.tableMenu,
  visible: inTable,
  menu: [
    button("addRowAbove", "↑"),
    button("addRowBelow", "↓"),
    button("addColumnLeft", "←"),
    button("addColumnRight", "→"),
    "separator",
    button("deleteRow", "−"),
    button("deleteColumn", "−"),
    "separator",
    button("alignColumnLeft", "⇤"),
    button("alignColumnCenter", "↔"),
    button("alignColumnRight", "⇥"),
    "separator",
    button("formatTable", "⌗"),
  ],
}));

/** The default toolbar, in order. Headings 4 to 6 always sit in the More menu. */
export const defaultToolbar: readonly ToolbarItem[] = Object.freeze([
  button("bold", icons.bold),
  button("italic", icons.italic),
  button("strikethrough", icons.strikethrough),
  button("inlineCode", icons.inlineCode),
  "separator",
  button("heading1", icons.heading1),
  button("heading2", icons.heading2),
  button("heading3", icons.heading3),
  "separator",
  button("bulletList", icons.bulletList),
  button("orderedList", icons.orderedList),
  button("taskList", icons.taskList),
  button("quote", icons.quote),
  "separator",
  button("link", icons.link),
  button("image", icons.image),
  button("codeBlock", icons.codeBlock),
  button("table", icons.table),
  tableMenu,
  button("horizontalRule", icons.horizontalRule),
  button("heading4", icons.heading4, true),
  button("heading5", icons.heading5, true),
  button("heading6", icons.heading6, true),
]);
