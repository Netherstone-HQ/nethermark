import { isolateHistory } from "@codemirror/commands";
import { Compartment, EditorState, Text } from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";
import { classFor } from "../classes.js";
import { commandNamed } from "../commands/registry.js";
import { iconsFacet, type Icons } from "../icons.js";
import { formattingKeymap, type Shortcuts } from "../keymap.js";
import { labelsFacet, type Labels } from "../labels.js";
import { themeFacet } from "../styles/index.js";
import { themes } from "../theme/index.js";
import { themeStyle } from "../theme/theme.js";
import { defaultToolbar, type ToolbarItem } from "../toolbar/items.js";
import { createToolbar, type Toolbar } from "../toolbar/toolbar.js";
import { buildEditor, themeContent, type MarkdownEditorOptions, type ThemeOption } from "./editor.js";

export type CreateMarkdownEditorOptions = MarkdownEditorOptions & {
  readonly parent: HTMLElement;
  readonly doc?: string;
  /** The toolbar's items, or false for none. */
  readonly toolbar?: readonly ToolbarItem[] | false;
};

/** An editor with its toolbar, and what a host changes it with. */
export type MarkdownEditor = {
  readonly view: EditorView;
  /** The doc, with the line endings it came in with. */
  getValue(): string;
  /** Replaces the doc as one undo step. */
  setValue(doc: string): void;
  focus(): void;
  /** Runs a command by name, built in or the host's own. Returns whether it applied. */
  run(command: string): boolean;
  /** Changes the theme. Undo history and the cursor stay. */
  setTheme(theme: ThemeOption): void;
  setReadOnly(on: boolean): void;
  /** Changes the keys; commands left out keep their defaults. */
  setShortcuts(shortcuts: Shortcuts): void;
  /** Replaces the labels; ones left out go back to their defaults. */
  setLabels(labels: Labels): void;
  /** Replaces the icons; ones left out go back to their defaults. */
  setIcons(icons: Icons): void;
  /** Takes the editor and toolbar out of the page. */
  destroy(): void;
};

/** CRLF docs keep CRLF: the editor counts their line breaks as one, and gives them back as written. */
function lineSeparatorFor(doc: string) {
  return doc.includes("\r\n") ? EditorState.lineSeparator.of("\r\n") : [];
}

/** Builds the editor and its toolbar inside `parent`, and returns its handle. */
export function createMarkdownEditor(options: CreateMarkdownEditorOptions): MarkdownEditor {
  const { parent, doc = "" } = options;
  const names = options.classNames ?? {};
  const { extension, compartments } = buildEditor(options, false);
  const lineSeparator = new Compartment();

  const root = document.createElement("div");
  root.className = classFor(names, "root");
  parent.append(root);
  // The root carries the theme's tokens, so anything a host puts inside it can read them.
  const rootTheme = ViewPlugin.define((view) => {
    let theme = view.state.facet(themeFacet);
    root.style.cssText = themeStyle(theme ?? themes.light);
    return {
      update: (update) => {
        const next = update.state.facet(themeFacet);
        if (next !== theme) root.style.cssText = themeStyle((theme = next) ?? themes.light);
      },
    };
  });

  const view = new EditorView({
    parent: root,
    state: EditorState.create({ doc, extensions: [extension, lineSeparator.of(lineSeparatorFor(doc)), rootTheme] }),
  });
  const toolbar: Toolbar | null = options.toolbar === false ? null : createToolbar(view, options.toolbar ?? defaultToolbar);
  if (toolbar) root.prepend(toolbar.dom);

  return {
    view,
    getValue: () => view.state.sliceDoc(),
    setValue: (next) => {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: Text.of(next.split(/\r\n|\r|\n/)) },
        effects: lineSeparator.reconfigure(lineSeparatorFor(next)),
        annotations: isolateHistory.of("full"),
        userEvent: "input.replace",
      });
    },
    focus: () => view.focus(),
    run: (name) => commandNamed(view.state, name)({ state: view.state, dispatch: (tr) => view.dispatch(tr) }),
    setTheme: (theme) => view.dispatch({ effects: compartments.theme.reconfigure(themeContent(theme, compartments.theme)) }),
    setReadOnly: (on) => view.dispatch({ effects: compartments.readOnly.reconfigure(EditorState.readOnly.of(on)) }),
    setShortcuts: (shortcuts) =>
      view.dispatch({ effects: compartments.shortcuts.reconfigure(formattingKeymap(shortcuts, options.commands ?? {})) }),
    setLabels: (labels) => view.dispatch({ effects: compartments.labels.reconfigure(labelsFacet.of(labels)) }),
    setIcons: (icons) => view.dispatch({ effects: compartments.icons.reconfigure(iconsFacet.of(icons)) }),
    destroy: () => {
      toolbar?.destroy();
      view.destroy();
      root.remove();
    },
  };
}
