import type { EditorState } from "@codemirror/state";
import type { MarkdownCommand } from "../commands/command.js";
import { commands, type CommandName } from "../commands/index.js";
import { inTable } from "../commands/tables.js";
import { icons } from "./icons.js";

/**
 * A button that runs a command. The icon is an SVG string, or plain text,
 * like `H1`, drawn in the UI font.
 */
export type ToolbarButton = {
  readonly command: CommandName | MarkdownCommand;
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

/** The command a button runs. */
export function commandOf(button: ToolbarButton): MarkdownCommand {
  return typeof button.command === "string" ? commands[button.command] : button.command;
}

export const isMenu = (item: ToolbarItem): item is ToolbarMenu => typeof item === "object" && "menu" in item;

const button = (command: CommandName, icon: string, label: string, inMore?: boolean): ToolbarButton =>
  defineToolbarItem({ command, icon, label, ...(inMore && { inMore }) });

/** The row, column and alignment commands, shown while the cursor is in a table. */
export const tableMenu: ToolbarMenu = defineToolbarItem({
  icon: icons.tableMenu,
  label: "Table",
  visible: inTable,
  menu: [
    button("addRowAbove", "↑", "Add row above"),
    button("addRowBelow", "↓", "Add row below"),
    button("addColumnLeft", "←", "Add column left"),
    button("addColumnRight", "→", "Add column right"),
    "separator",
    button("deleteRow", "−", "Delete row"),
    button("deleteColumn", "−", "Delete column"),
    "separator",
    button("alignColumnLeft", "⇤", "Align left"),
    button("alignColumnCenter", "↔", "Align center"),
    button("alignColumnRight", "⇥", "Align right"),
    "separator",
    button("formatTable", "⌗", "Format table"),
  ],
});

/** The default toolbar, in order. Headings 4 to 6 always sit in the More menu. */
export const defaultToolbar: readonly ToolbarItem[] = Object.freeze([
  button("bold", icons.bold, "Bold"),
  button("italic", icons.italic, "Italic"),
  button("strikethrough", icons.strikethrough, "Strikethrough"),
  button("inlineCode", icons.inlineCode, "Inline code"),
  "separator",
  button("heading1", icons.heading1, "Heading 1"),
  button("heading2", icons.heading2, "Heading 2"),
  button("heading3", icons.heading3, "Heading 3"),
  "separator",
  button("bulletList", icons.bulletList, "Bullet list"),
  button("orderedList", icons.orderedList, "Numbered list"),
  button("taskList", icons.taskList, "Task list"),
  button("quote", icons.quote, "Quote"),
  "separator",
  button("link", icons.link, "Link"),
  button("image", icons.image, "Image"),
  button("codeBlock", icons.codeBlock, "Code block"),
  button("table", icons.table, "Table"),
  tableMenu,
  button("horizontalRule", icons.horizontalRule, "Horizontal rule"),
  button("heading4", icons.heading4, "Heading 4", true),
  button("heading5", icons.heading5, "Heading 5", true),
  button("heading6", icons.heading6, "Heading 6", true),
]);
