/// <reference types="vite/client" />
import { createElement, StrictMode, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { createMarkdownEditor, defaultToolbar } from "../../../src/index.js";
import { createPreview, previewButton } from "../../../src/preview/index.js";

/**
 * A React 19 app on Tailwind 4 that mounts the editor with its toolbar and
 * preview from an effect, in Strict Mode, as a host would. `?ordered` loads
 * the Tailwind setup that names the `nme` layer's place.
 */
const ordered = new URLSearchParams(location.search).has("ordered");
await (ordered ? import("./tailwind-ordered.css") : import("./tailwind.css"));

const doc = "# Title\n\nSome **bold** text.\n\n- one\n- two";
/** What a renderer makes of the doc. The tests check the preview's look, not the rendering. */
const html =
  `<h1 data-line="0">Title</h1><p data-line="2">Some <strong>bold</strong> text.</p>` +
  `<ul data-line="4"><li>one</li><li>two</li></ul><p data-line="7">After.</p>`;

function Editor() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const editor = createMarkdownEditor({
      parent: ref.current!,
      doc,
      toolbar: [previewButton(), "separator", ...defaultToolbar],
      classNames: { strong: "text-red-600" },
    });
    const preview = createPreview(editor.view, { render: () => html });
    return () => {
      preview.destroy();
      editor.destroy();
    };
  }, []);
  return createElement("div", { ref, className: "m-4" });
}

createRoot(document.getElementById("app")!).render(createElement(StrictMode, null, createElement(Editor)));
