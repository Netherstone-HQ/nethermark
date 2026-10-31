import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  createMarkdownEditor,
  createToolbar,
  defaultToolbar,
  defineCommand,
  type Labels,
  type ToolbarItem,
  themes,
  type MarkdownEditor,
  type Toolbar,
} from "../../../src/index.js";
import { formattingKeymap } from "../../../src/keymap.js";
import { createPreview, previewButton, type Preview, type PreviewLayout } from "../../../src/preview/index.js";
import { highlightSyntax } from "../../highlight-syntax.js";
import { editorStyles, themeExtension } from "../../../src/styles/index.js";

type Options = {
  theme?: keyof typeof themes;
  toolbar?: boolean;
  readOnly?: boolean;
  width?: string;
  /** Moves the table menu to the start of the bar. */
  tableFirst?: boolean;
};

const isTableMenu = (item: ToolbarItem) => typeof item === "object" && "menu" in item && item.label === "Table";

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

window.mount = (doc, { theme = "light", toolbar = false, readOnly = false, width, tableFirst = false } = {}) => {
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
  const items = tableFirst
    ? [...defaultToolbar.filter(isTableMenu), ...defaultToolbar.filter((item) => !isTableMenu(item))]
    : defaultToolbar;
  window.formatBar = toolbar ? createToolbar(window.view, items) : undefined;
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
  /** A host's ==highlight== syntax, command and toolbar button. */
  highlight?: boolean;
  paste?: "sync" | "async" | "none";
  drop?: "sync" | "async";
  labels?: Labels;
};

declare global {
  interface Window {
    create(options?: CreateOptions): void;
    editor?: MarkdownEditor;
    changes: string[];
    /** Settles the pending async hook with Markdown. */
    settle?: (markdown: string) => void;
    /** What the last hook got, with files as their names. */
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
  return (input: { files?: readonly File[] }) => {
    window.hookInput = { ...input, ...(input.files && { files: input.files.map((file) => file.name) }) };
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
    ...(options.highlight && {
      markdownExtensions: [highlightSyntax],
      commands: { highlight: defineCommand({ inline: { mark: "==", node: "Highlight" } }) },
      toolbar: [...defaultToolbar, { command: "highlight", icon: "=", label: "Highlight" }],
    }),
    ...(options.lineNumbers === false && { lineNumbers: false }),
    ...(options.readOnly && { readOnly: true }),
    ...(options.placeholder && { placeholder: options.placeholder }),
    ...(options.ariaLabel && { ariaLabel: options.ariaLabel }),
    ...(options.classNames && { classNames: options.classNames }),
    ...(options.labels && { labels: options.labels }),
    onChange: (doc) => window.changes.push(doc),
    ...(options.paste && { onPaste: hook(options.paste, "**pasted**") }),
    ...(options.drop && { onDrop: hook(options.drop, "![](picture.png)") }),
  });
  window.view = window.editor.view;
};

// ── Preview ──────────────────────────────────────────────────────────────────

type PreviewFixtureOptions = {
  doc?: string;
  layout?: PreviewLayout;
  open?: boolean;
  /** Markdown to HTML: each line a paragraph with its `data-line`, or this HTML as is. */
  html?: string;
  async?: boolean;
  sanitize?: false;
  readOnly?: boolean;
};

declare global {
  interface Window {
    createWithPreview(options?: PreviewFixtureOptions): void;
    preview?: Preview;
    renders: number;
  }
}

const escape = (text: string) => text.replace(/[&<>]/g, (char) => `&#${char.charCodeAt(0)};`);

window.createWithPreview = (options = {}) => {
  window.preview?.destroy();
  window.editor?.destroy();
  const app = document.getElementById("app")!;
  app.replaceChildren();
  window.renders = 0;
  window.editor = createMarkdownEditor({
    parent: app,
    doc: options.doc ?? "",
    readOnly: options.readOnly ?? false,
    toolbar: [...defaultToolbar, "separator", previewButton()],
  });
  window.view = window.editor.view;
  const lines = (markdown: string) =>
    markdown.split("\n").map((line, i) => `<p data-line="${i}">${escape(line) || "&nbsp;"}</p>`).join("");
  const render = (markdown: string) => {
    window.renders++;
    const html = options.html ?? lines(markdown);
    return options.async ? new Promise<string>((resolve) => setTimeout(() => resolve(html))) : html;
  };
  window.preview = createPreview(window.view, {
    render,
    ...(options.layout && { layout: options.layout }),
    ...(options.open !== undefined && { open: options.open }),
    ...(options.sanitize === false && { sanitize: false }),
  });
};
