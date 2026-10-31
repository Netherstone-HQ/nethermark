import { blockCommand, fenceCommand } from "./block.js";
import { defineCommand as fromRun, type CommandDefinition as RunDefinition, type MarkdownCommand } from "./command.js";
import { inlineMarkCommand } from "./inline.js";
import { linePrefixCommand } from "./line.js";

/**
 * What a command is made from: a function that builds its transaction, or
 * one of the kinds the built-in commands are made of, for a host's own
 * syntax, so it follows the same toggle and pressed-state rules:
 *
 * - `inline`: a mark around text, like `==` for a Highlight node, with the inline rules
 * - `line`: a prefix on each line, like `%% `, with the line rules
 * - `fence`: a fenced block with an info string, like `mermaid`
 * - `block`: a header line and a prefix on every line, like a callout's `> [!NOTE]` and `> `
 *
 * The parser only knows a host's syntax through the editor's
 * `markdownExtensions`. An inline mark needs that, to find its node; the
 * others read their text when they're given no node.
 */
export type CommandDefinition =
  | RunDefinition
  | { readonly inline: { readonly mark: string; readonly node: string; readonly markNode?: string } }
  | { readonly line: { readonly prefix: string; readonly node?: string } }
  | { readonly fence: string }
  | { readonly block: { readonly header: string; readonly prefix: string } };

/** Makes a command, from a function or from one of the kinds. */
export function defineCommand(definition: CommandDefinition): MarkdownCommand {
  if ("inline" in definition) return inlineMarkCommand(definition.inline);
  if ("line" in definition) return linePrefixCommand(definition.line);
  if ("fence" in definition) {
    if (!definition.fence.trim()) throw new RangeError("A fence kind needs an info string, like \"mermaid\". codeBlock is the fence without one.");
    return fenceCommand(definition.fence.trim());
  }
  if ("block" in definition) return blockCommand(definition.block);
  return fromRun(definition);
}
