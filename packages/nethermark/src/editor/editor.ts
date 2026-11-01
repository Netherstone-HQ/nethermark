import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import type { MarkdownExtension } from "@lezer/markdown";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder,
  ViewPlugin,
} from "@codemirror/view";
import { classFor, classNamesFacet, type ClassNames } from "../classes.js";
import type { MarkdownCommand } from "../commands/command.js";
import { commandsFacet } from "../commands/registry.js";
import { iconsFacet, type Icons } from "../icons.js";
import { formattingKeymap, type Shortcuts } from "../keymap.js";
import { labelsFacet, type Labels } from "../labels.js";
import { editorStyles, themeExtension } from "../styles/index.js";
import { themes } from "../theme/index.js";
import type { Theme } from "../theme/theme.js";
import { pasteAndDrop, type DropHook, type PasteHook } from "./paste.js";

/** A theme, `"auto"` for the presets following the system, or a light and dark pair that does the same. */
export type ThemeOption = Theme | "auto" | { readonly light: Theme; readonly dark: Theme };

/** Options for the editor bundle, which `createMarkdownEditor` takes too. */
export type MarkdownEditorOptions = {
  /** Called once per transaction that changes the doc, with the whole doc. Debounce in the host if needed. */
  readonly onChange?: (doc: string) => void;
  readonly theme?: ThemeOption;
  readonly lineNumbers?: boolean;
  readonly lineWrapping?: boolean;
  readonly readOnly?: boolean;
  readonly placeholder?: string;
  /** The text area's accessible name. */
  readonly ariaLabel?: string;
  readonly shortcuts?: Shortcuts;
  /** The host's own commands by name, for `run`, toolbar items and `shortcuts`. Per editor, never global. */
  readonly commands?: Readonly<Record<string, MarkdownCommand>>;
  readonly classNames?: ClassNames;
  /** Strings to replace, such as a translation: toolbar labels and tooltips, and text commands insert. */
  readonly labels?: Labels;
  /**
   * Icons to replace, each an SVG string or text: the built-in toolbar
   * buttons, More, the table menu and its items, and the preview button.
   * A full set of another Phosphor weight is in `@netherstone/nethermark/icons/<weight>`.
   */
  readonly icons?: Icons;
  readonly onPaste?: PasteHook;
  readonly onDrop?: DropHook;
  /**
   * Lezer Markdown extensions, for a host's own syntax: its nodes then show
   * in the tree, so commands from `defineCommand` find them.
   */
  readonly markdownExtensions?: readonly MarkdownExtension[];
  /** More CodeMirror extensions, added last so they can override the editor's own. */
  readonly extensions?: readonly Extension[];
};

const DARK = "(prefers-color-scheme: dark)";

function prefersDark(): boolean {
  return typeof matchMedia === "function" && matchMedia(DARK).matches;
}

function themePair(option: ThemeOption): { light: Theme; dark: Theme } | null {
  if (option === "auto") return { light: themes.light, dark: themes.dark };
  return "light" in option && "dark" in option ? option : null;
}

/**
 * What goes in the theme compartment: the theme's tokens, and for a pair, a
 * plugin that swaps between them when the system's preference changes.
 */
export function themeContent(option: ThemeOption, compartment: Compartment): Extension {
  const pair = themePair(option);
  if (!pair) return themeExtension(option as Theme);
  const follow = ViewPlugin.define((view) => {
    if (typeof matchMedia !== "function") return {};
    const query = matchMedia(DARK);
    const change = () => view.dispatch({ effects: compartment.reconfigure(themeContent(option, compartment)) });
    query.addEventListener("change", change);
    return { destroy: () => query.removeEventListener("change", change) };
  });
  return [themeExtension(prefersDark() ? pair.dark : pair.light), follow];
}

/** Puts the host's classes on the gutters, which CodeMirror builds without a hook for them. */
const gutterClasses = ViewPlugin.define((view) => {
  const apply = () => {
    const gutters = view.dom.querySelector(".cm-gutters");
    if (gutters) gutters.classList.add(...classFor(view.state.facet(classNamesFacet), "gutter").split(/\s+/));
  };
  apply();
  return { update: apply };
});

/** The compartments the handle reconfigures, so nothing is rebuilt. */
export type Compartments = {
  readonly theme: Compartment;
  readonly readOnly: Compartment;
  readonly shortcuts: Compartment;
  readonly labels: Compartment;
  readonly icons: Compartment;
};

/**
 * The editor as an extension bundle, with the compartments for changing it
 * later. `root` puts the `nme-root` class on the editor itself, for hosts
 * without a wrapper of ours.
 */
export function buildEditor(options: MarkdownEditorOptions, root: boolean): { extension: Extension; compartments: Compartments } {
  const compartments: Compartments = { theme: new Compartment(), readOnly: new Compartment(), shortcuts: new Compartment(), labels: new Compartment(), icons: new Compartment() };
  const names = options.classNames ?? {};
  const custom = options.commands ?? {};
  const { onChange } = options;
  const extension: Extension = [
    markdown({ base: markdownLanguage, extensions: [...(options.markdownExtensions ?? [])] }),
    history(),
    drawSelection(),
    dropCursor(),
    highlightActiveLine(),
    options.lineNumbers === false ? [] : [lineNumbers(), highlightActiveLineGutter(), gutterClasses],
    options.lineWrapping === false ? [] : EditorView.lineWrapping,
    options.placeholder ? placeholder(options.placeholder) : [],
    EditorView.contentAttributes.of({
      class: classFor(names, "content"),
      ...(options.ariaLabel && { "aria-label": options.ariaLabel }),
    }),
    root ? EditorView.editorAttributes.of({ class: classFor(names, "root") }) : [],
    classNamesFacet.of(names),
    commandsFacet.of(custom),
    editorStyles(names),
    compartments.theme.of(themeContent(options.theme ?? themes.light, compartments.theme)),
    compartments.readOnly.of(EditorState.readOnly.of(options.readOnly ?? false)),
    compartments.shortcuts.of(formattingKeymap(options.shortcuts, custom)),
    compartments.labels.of(labelsFacet.of(options.labels ?? {})),
    compartments.icons.of(iconsFacet.of(options.icons ?? {})),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    pasteAndDrop(options.onPaste, options.onDrop),
    onChange
      ? EditorView.updateListener.of((update) => {
          for (const tr of update.transactions) if (tr.docChanged) onChange(tr.state.sliceDoc());
        })
      : [],
    options.extensions ?? [],
  ];
  return { extension, compartments };
}

/**
 * The editor as a CodeMirror extension bundle, for hosts that build their own
 * `EditorView`. `createMarkdownEditor` builds the view and toolbar too.
 */
export function markdownEditor(options: MarkdownEditorOptions = {}): Extension {
  return buildEditor(options, true).extension;
}
