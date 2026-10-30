import type { EditorState, StateCommand, TransactionSpec } from "@codemirror/state";

/**
 * A formatting command: a plain CodeMirror `StateCommand` that makes one
 * transaction, so it's one undo step. `isActive` says whether its format is
 * on at the main cursor, for the toolbar's pressed state. Commands that only
 * insert something have none.
 */
export type MarkdownCommand = StateCommand & {
  readonly isActive?: (state: EditorState) => boolean;
};

export type CommandDefinition = {
  /** The transaction to make, or null when the command doesn't apply here. */
  readonly run: (state: EditorState) => TransactionSpec | null;
  readonly isActive?: (state: EditorState) => boolean;
};

/**
 * Makes a command from a function that builds its transaction. The command
 * does nothing in a read-only editor, and returns false when it doesn't
 * apply, so the next key binding gets a turn.
 */
export function defineCommand({ run, isActive }: CommandDefinition): MarkdownCommand {
  const command: StateCommand = ({ state, dispatch }) => {
    if (state.readOnly) return false;
    const spec = run(state);
    if (!spec) return false;
    dispatch(state.update(spec, { scrollIntoView: true, userEvent: "input.format" }));
    return true;
  };
  return isActive ? Object.assign(command, { isActive }) : command;
}
