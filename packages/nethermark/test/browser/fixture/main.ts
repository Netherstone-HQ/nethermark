import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { createToolbar, themes, type Toolbar } from "../../../src/index.js";
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
        editorStyles,
        themeExtension(themes[theme]),
        formattingKeymap(),
        EditorState.readOnly.of(readOnly),
      ],
    }),
  });
  window.formatBar = toolbar ? createToolbar(window.view) : undefined;
  if (window.formatBar) app.prepend(window.formatBar.dom);
};
