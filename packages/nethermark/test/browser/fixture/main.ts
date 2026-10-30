import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { themes } from "../../../src/index.js";
import { editorStyles, themeExtension } from "../../../src/styles/index.js";

/**
 * The page tests drive: `mount` builds an editor in #app from a doc and a
 * preset's name, replacing any editor already there.
 */
declare global {
  interface Window {
    mount(doc: string, theme?: keyof typeof themes): void;
    view?: EditorView;
  }
}

window.mount = (doc, theme = "light") => {
  window.view?.destroy();
  window.view = new EditorView({
    parent: document.getElementById("app")!,
    state: EditorState.create({
      doc,
      extensions: [markdown({ base: markdownLanguage }), editorStyles, themeExtension(themes[theme])],
    }),
  });
};
