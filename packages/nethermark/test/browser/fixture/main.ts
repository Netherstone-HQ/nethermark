import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  createMarkdownEditor,
  createToolbar,
  defaultToolbar,
  defineCommand,
  themes,
  type MarkdownEditor,
  type Toolbar,
} from "../../../src/index.js";
import { formattingKeymap } from "../../../src/keymap.js";
import { editorStyles, themeExtension } from "../../../src/styles/index.js";

type Options = { theme?: keyof typeof themes; toolbar?: boolean; readOnly?: boolean; width?: string };

/**
 * The page tests drive: `mount` builds an editor in #app from a doc, with a
 * toolbar above it when asked, replacing whatever was there.
 */
declare global {
  interface Window {
    mount(doc: string, options?: Options): void;
    view?: EditorView;
    formatBar?: Toolbar;
  }
}

window.mount = (doc, { theme = "light", toolbar = false, readOnly = false, width } = {}) => {
  window.formatBar?.destroy();
  window.view?.destroy();
  const app = document.getElementById("app")!;
  app.replaceChildren();
  if (width) app.style.width = width;
  const editor = document.createElement("div");
  app.append(editor);
  window.view = new EditorView({
    parent: editor,
    state: EditorState.create({
      doc,
      extensions: [
        markdown({ base: markdownLanguage }),
        editorStyles(),
        themeExtension(themes[theme]),
        formattingKeymap(),
        EditorState.readOnly.of(readOnly),
      ],
    }),
  });
  window.formatBar = toolbar ? createToolbar(window.view) : undefined;
  if (window.formatBar) app.prepend(window.formatBar.dom);
};

// ── createMarkdownEditor ─────────────────────────────────────────────────────

type CreateOptions = {
  doc?: string;
  theme?: "light" | "dark" | "auto";
  toolbar?: boolean;
  lineNumbers?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  classNames?: Record<string, string>;
  custom?: boolean;
  paste?: "sync" | "async" | "none";
  drop?: "sync" | "async";
};

declare global {
  interface Window {
    create(options?: CreateOptions): void;
    editor?: MarkdownEditor;
    changes: string[];
    /** Settles the pending async hook with Markdown. */
    settle?: (markdown: string) => void;
    hookInput?: unknown;
    presets: typeof themes;
  }
}

window.presets = themes;

/** Uppercases the selection: a host's own command. */
const shout = defineCommand({
  run: (state) => {
    const { from, to } = state.selection.main;
    return from === to ? null : { changes: { from, to, insert: state.sliceDoc(from, to).toUpperCase() } };
  },
});

function hook(kind: "sync" | "async" | "none" | undefined, markdown: string) {
  if (!kind) return undefined;
  return (input: unknown) => {
    window.hookInput = input;
    if (kind === "none") return undefined;
    if (kind === "sync") return markdown;
    return new Promise<string>((resolve) => (window.settle = resolve));
  };
}

window.create = (options = {}) => {
  window.editor?.destroy();
  window.formatBar?.destroy();
  window.view?.destroy();
  const app = document.getElementById("app")!;
  app.replaceChildren();
  window.changes = [];
  const theme = options.theme === "auto" ? "auto" : themes[options.theme ?? "light"];
  window.editor = createMarkdownEditor({
    parent: app,
    doc: options.doc ?? "",
    theme,
    ...(options.toolbar === false && { toolbar: false }),
    ...(options.custom && {
      commands: { shout },
      shortcuts: { shout: ["Mod-u"] },
      toolbar: [...defaultToolbar, { command: "shout", icon: "!", label: "Shout" }],
    }),
    ...(options.lineNumbers === false && { lineNumbers: false }),
    ...(options.readOnly && { readOnly: true }),
    ...(options.placeholder && { placeholder: options.placeholder }),
    ...(options.ariaLabel && { ariaLabel: options.ariaLabel }),
    ...(options.classNames && { classNames: options.classNames }),
    onChange: (doc) => window.changes.push(doc),
    ...(options.paste && { onPaste: hook(options.paste, "**pasted**") }),
    ...(options.drop && { onDrop: hook(options.drop, "![](picture.png)") }),
  });
  window.view = window.editor.view;
};
