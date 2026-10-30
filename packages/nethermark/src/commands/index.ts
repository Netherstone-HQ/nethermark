import { codeBlockCommand, horizontalRuleCommand, imageCommand, tableCommand } from "./block.js";
import { boldCommand, inlineCodeCommand, italicCommand, linkCommand, strikethroughCommand } from "./inline.js";
import {
  addColumnLeftCommand,
  addColumnRightCommand,
  addRowAboveCommand,
  addRowBelowCommand,
  alignColumnCenterCommand,
  alignColumnLeftCommand,
  alignColumnRightCommand,
  deleteColumnCommand,
  deleteRowCommand,
  formatTableCommand,
} from "./tables.js";
import {
  clearFormattingCommand,
  convertToInlineCommand,
  convertToReferenceCommand,
  escapeSelectionCommand,
  footnoteCommand,
  hardBreakCommand,
} from "./text.js";
import { indentListCommand, outdentListCommand, toggleTaskDoneCommand } from "./lists.js";
import {
  bulletListCommand,
  headingCommands,
  orderedListCommand,
  paragraphCommand,
  quoteCommand,
  taskListCommand,
} from "./line.js";

const [heading1, heading2, heading3, heading4, heading5, heading6] = headingCommands;

/** Every formatting command, by name. */
export const commands = {
  bold: boldCommand,
  italic: italicCommand,
  strikethrough: strikethroughCommand,
  inlineCode: inlineCodeCommand,
  link: linkCommand,
  heading1,
  heading2,
  heading3,
  heading4,
  heading5,
  heading6,
  paragraph: paragraphCommand,
  bulletList: bulletListCommand,
  orderedList: orderedListCommand,
  taskList: taskListCommand,
  quote: quoteCommand,
  codeBlock: codeBlockCommand,
  horizontalRule: horizontalRuleCommand,
  table: tableCommand,
  image: imageCommand,
  indentList: indentListCommand,
  outdentList: outdentListCommand,
  toggleTaskDone: toggleTaskDoneCommand,
  addRowAbove: addRowAboveCommand,
  addRowBelow: addRowBelowCommand,
  addColumnLeft: addColumnLeftCommand,
  addColumnRight: addColumnRightCommand,
  deleteRow: deleteRowCommand,
  deleteColumn: deleteColumnCommand,
  alignColumnLeft: alignColumnLeftCommand,
  alignColumnCenter: alignColumnCenterCommand,
  alignColumnRight: alignColumnRightCommand,
  formatTable: formatTableCommand,
  hardBreak: hardBreakCommand,
  footnote: footnoteCommand,
  convertToReference: convertToReferenceCommand,
  convertToInline: convertToInlineCommand,
  escapeSelection: escapeSelectionCommand,
  clearFormatting: clearFormattingCommand,
};

export type CommandName = keyof typeof commands;
