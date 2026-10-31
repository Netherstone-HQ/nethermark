import { StateEffect, StateField, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/** What a hook gives back: Markdown to insert, nothing to fall back, or either later. */
export type HookResult = string | void | Promise<string | void>;

/**
 * Called when the clipboard, or a drop, holds HTML. Return the Markdown to
 * insert, or nothing for the plain text. The package never parses HTML.
 */
export type PasteHook = (input: { readonly html: string; readonly text: string }) => HookResult;

/**
 * Called when files are dropped, with the doc position they were dropped at.
 * Return the Markdown to insert there, such as `![](picture.png)` once the
 * host has stored the picture, or nothing for the editor's own handling.
 */
export type DropHook = (input: { readonly files: readonly File[]; readonly position: number }) => HookResult;

type Pending = { readonly id: number; readonly from: number; readonly to: number };

const addPending = StateEffect.define<Pending>();
const removePending = StateEffect.define<number>();

/** Where results still on their way will go, kept in place through edits made meanwhile. */
const pending = StateField.define<readonly Pending[]>({
  create: () => [],
  update(value, tr) {
    let next = tr.docChanged
      ? value.map((p) => ({ id: p.id, from: tr.changes.mapPos(p.from, -1), to: tr.changes.mapPos(p.to, 1) }))
      : value;
    for (const effect of tr.effects) {
      if (effect.is(addPending)) next = [...next, effect.value];
      else if (effect.is(removePending)) next = next.filter((p) => p.id !== effect.value);
    }
    return next;
  },
});

let ids = 0;

function isPromise(value: HookResult): value is Promise<string | void> {
  return typeof (value as Promise<unknown> | undefined)?.then === "function";
}

/**
 * Inserts a hook's result over a range: now if it's ready, or once it
 * resolves, at wherever the range has moved to. When the hook gives nothing
 * back, the fallback text goes in.
 */
function deliver(view: EditorView, from: number, to: number, result: HookResult, fallback: string, userEvent: string): void {
  if (!isPromise(result)) {
    // The cursor goes after the text, counting each line break as one position.
    const changes = view.state.changes({ from, to, insert: result ?? fallback });
    view.dispatch({ changes, selection: { anchor: changes.mapPos(to, 1) }, userEvent, scrollIntoView: true });
    return;
  }
  const id = ++ids;
  view.dispatch({ effects: addPending.of({ id, from, to }) });
  const finish = (insert: string) => {
    const place = view.state.field(pending).find((p) => p.id === id);
    if (!place) return;
    view.dispatch({
      changes: { from: place.from, to: place.to, insert },
      effects: removePending.of(id),
      userEvent,
    });
  };
  result.then(
    (markdown) => finish(markdown ?? fallback),
    (error: unknown) => {
      finish(fallback);
      throw error;
    },
  );
}

/** The paste and drop hooks, for the editor. */
export function pasteAndDrop(onPaste?: PasteHook, onDrop?: DropHook): Extension {
  if (!onPaste && !onDrop) return [];
  return [
    pending,
    EditorView.domEventHandlers({
      paste(event, view) {
        const html = event.clipboardData?.getData("text/html") ?? "";
        if (!onPaste || !html) return false;
        const text = event.clipboardData?.getData("text/plain") ?? "";
        const result = onPaste({ html, text });
        if (result === undefined) return false;
        event.preventDefault();
        const { from, to } = view.state.selection.main;
        deliver(view, from, to, result, text, "input.paste");
        return true;
      },
      drop(event, view) {
        const data = event.dataTransfer;
        if (!data) return false;
        const position = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.head;
        const files = [...data.files];
        if (files.length > 0 && onDrop) {
          const result = onDrop({ files, position });
          if (result === undefined) return false;
          event.preventDefault();
          deliver(view, position, position, result, "", "input.drop");
          return true;
        }
        // Dropped HTML goes the way pasted HTML does.
        const html = data.getData("text/html");
        if (files.length === 0 && html && onPaste) {
          const text = data.getData("text/plain");
          const result = onPaste({ html, text });
          if (result === undefined) return false;
          event.preventDefault();
          deliver(view, position, position, result, text, "input.drop");
          return true;
        }
        return false;
      },
    }),
  ];
}
