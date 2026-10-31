import { Facet, type EditorState } from "@codemirror/state";
import type { MarkdownCommand } from "./command.js";
import { commands } from "./index.js";

/** Every command in an editor by name: the built-in ones, and the host's from the `commands` option. */
export const commandsFacet = Facet.define<Readonly<Record<string, MarkdownCommand>>, Readonly<Record<string, MarkdownCommand>>>({
  combine: (values) => Object.assign({}, commands, ...values) as Record<string, MarkdownCommand>,
});

/** The command a name means in this editor. */
export function commandNamed(state: EditorState, name: string): MarkdownCommand {
  const command = state.facet(commandsFacet)[name];
  if (!command) throw new RangeError(`There's no command named "${name}". Hosts add their own with the commands option.`);
  return command;
}
