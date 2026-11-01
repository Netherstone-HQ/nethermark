import type { MarkdownEditor, ToolbarItem } from "@netherstone/nethermark";
import { createContext, useContext, useEffect, useLayoutEffect, type DependencyList } from "react";

/** A layout effect in the browser and a plain one on a server, where neither runs, so server rendering doesn't warn. */
export const useIsomorphicLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect;

/** What an add-on does with an editor, and how it undoes that. */
export type EditorEffect = (editor: MarkdownEditor) => void | (() => void);

type Entry = { readonly effect: EditorEffect; cleanup: (() => void) | void };

/**
 * The add-ons inside one `<MarkdownEditor>`. Each runs with the editor while
 * there is one, and is undone before the editor goes, whatever order React
 * mounts and unmounts them in. Add-ons can also add items to the default
 * toolbar, the way the preview adds its button.
 */
export class Addons {
  private editor: MarkdownEditor | null = null;
  private readonly entries = new Set<Entry>();
  private readonly toolbar = new Set<readonly ToolbarItem[]>();
  /** Called when the add-ons' toolbar items change, so the editor can build its toolbar again. */
  onToolbarChange: (() => void) | null = null;

  /** Runs every add-on with a new editor. */
  attach(editor: MarkdownEditor): void {
    this.editor = editor;
    for (const entry of this.entries) entry.cleanup = entry.effect(editor);
  }

  /** Undoes every add-on, newest first, before the editor is destroyed. */
  detach(): void {
    for (const entry of [...this.entries].reverse()) undo(entry);
    this.editor = null;
  }

  /** Adds an add-on, running it now if there's an editor. Returns what removes it. */
  add(effect: EditorEffect): () => void {
    const entry: Entry = { effect, cleanup: undefined };
    this.entries.add(entry);
    if (this.editor) entry.cleanup = effect(this.editor);
    return () => {
      this.entries.delete(entry);
      undo(entry);
    };
  }

  /** Adds items to the end of the default toolbar, after a separator. Returns what takes them out. */
  addToolbarItems(items: readonly ToolbarItem[]): () => void {
    this.toolbar.add(items);
    this.onToolbarChange?.();
    return () => {
      this.toolbar.delete(items);
      this.onToolbarChange?.();
    };
  }

  /** The items add-ons give the default toolbar, in the order they were added. */
  toolbarItems(): readonly ToolbarItem[] {
    return [...this.toolbar].flat();
  }
}

function undo(entry: Entry): void {
  const { cleanup } = entry;
  entry.cleanup = undefined;
  cleanup?.();
}

export const AddonsContext = createContext<Addons | null>(null);

function useAddons(hook: string): Addons {
  const addons = useContext(AddonsContext);
  if (!addons) throw new Error(`${hook} needs to be inside a <MarkdownEditor>.`);
  return addons;
}

/**
 * Runs `effect` with the editor of the `<MarkdownEditor>` it's inside, like
 * `useEffect`: again when `deps` change or the editor is built again, with the
 * cleanup it returns in between. It waits for the editor, and its cleanup
 * runs before the editor is destroyed. For add-ons such as the preview, and a
 * host's own.
 */
export function useEditorEffect(effect: EditorEffect, deps: DependencyList): void {
  const addons = useAddons("useEditorEffect");
  useIsomorphicLayoutEffect(() => addons.add(effect), [addons, ...deps]);
}

/**
 * Adds items to the editor's default toolbar while the component that calls
 * it is mounted. A host that gives its own `toolbar` places them itself.
 */
export function useToolbarItems(items: readonly ToolbarItem[]): void {
  const addons = useAddons("useToolbarItems");
  useIsomorphicLayoutEffect(() => addons.addToolbarItems(items), [addons, items]);
}
