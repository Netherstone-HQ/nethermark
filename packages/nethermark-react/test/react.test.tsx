import { defaultToolbar, type MarkdownEditor as EditorHandle } from "@netherstone/nethermark";
import { act, StrictMode, useState, version, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MarkdownEditor, useEditorEffect, type MarkdownEditorProps } from "../src/index.js";
import { Preview, previewButton, type PreviewHandle } from "../src/preview.js";

declare const __REACT__: string;

test("runs on the React it's meant to", () => {
  expect(version.split(".")[0]).toBe(__REACT__);
});

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const render = (node: ReactNode) => act(() => root.render(node));
const wait = (ms = 20) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

/** Types at the end of the doc, the way a keypress lands. */
function type(editor: EditorHandle, text: string) {
  const end = editor.view.state.doc.length;
  act(() => editor.view.dispatch({ changes: { from: end, insert: text }, selection: { anchor: end + text.length }, userEvent: "input.type" }));
}

function paste(editor: EditorHandle, html: string) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  const data = { "text/html": html, "text/plain": "plain" } as Record<string, string>;
  Object.defineProperty(event, "clipboardData", { value: { getData: (kind: string) => data[kind] ?? "", files: [] } });
  act(() => {
    editor.view.contentDOM.dispatchEvent(event);
  });
}

describe("MarkdownEditor", () => {
  test("builds the editor with its toolbar, and hands its handle to the ref", () => {
    let editor: EditorHandle | null = null;
    render(<MarkdownEditor ref={(handle) => void (editor = handle)} defaultValue="# Hi" className="host" />);
    expect(host.querySelector(".host .nme-root .cm-editor")).not.toBeNull();
    expect(host.querySelector("[role=toolbar]")).not.toBeNull();
    expect(editor!.getValue()).toBe("# Hi");
  });

  test("a controlled editor doesn't set its own echo back, so the cursor and undo stay", () => {
    let editor: EditorHandle | null = null;
    const changes: string[] = [];
    function Host() {
      const [value, setValue] = useState("a");
      return (
        <MarkdownEditor
          ref={(handle) => void (editor = handle)}
          value={value}
          onChange={(next) => {
            changes.push(next);
            setValue(next);
          }}
        />
      );
    }
    render(<Host />);
    const setValue = vi.spyOn(editor!, "setValue");
    type(editor!, "b");
    type(editor!, "c");
    expect(changes).toEqual(["ab", "abc"]);
    expect(setValue).not.toHaveBeenCalled();
    expect(editor!.view.state.selection.main.head).toBe(3);
  });

  test("a new value from the host goes in, without calling onChange", () => {
    let editor: EditorHandle | null = null;
    const onChange = vi.fn();
    const props = (value: string): MarkdownEditorProps => ({ ref: (handle: EditorHandle | null) => void (editor = handle), value, onChange }) as never;
    render(<MarkdownEditor {...props("one")} />);
    render(<MarkdownEditor {...props("two")} />);
    expect(editor!.getValue()).toBe("two");
    expect(onChange).not.toHaveBeenCalled();
    type(editor!, "!");
    expect(onChange).toHaveBeenLastCalledWith("two!");
    render(<MarkdownEditor {...props("three")} />);
    expect(editor!.getValue()).toBe("three");
  });

  test("Strict Mode's second mount leaves one editor, and unmounting leaves none", () => {
    render(
      <StrictMode>
        <MarkdownEditor defaultValue="x" />
      </StrictMode>,
    );
    expect(host.querySelectorAll(".cm-editor")).toHaveLength(1);
    expect(host.querySelectorAll("[role=toolbar]")).toHaveLength(1);
    render(null);
    expect(host.querySelector(".nme-root")).toBeNull();
  });

  test("Strict Mode keeps the doc typed before a rebuild", () => {
    let editor: EditorHandle | null = null;
    render(
      <StrictMode>
        <MarkdownEditor ref={(handle) => void (editor = handle)} defaultValue="a" />
      </StrictMode>,
    );
    type(editor!, "b");
    expect(editor!.getValue()).toBe("ab");
  });

  test("labels change in place, and the same labels written inline each render aren't a change", () => {
    let editor: EditorHandle | null = null;
    const ref = (handle: EditorHandle | null) => void (editor = handle);
    render(<MarkdownEditor ref={ref} labels={{ toolbar: "Mise en forme" }} />);
    expect(host.querySelector("[role=toolbar]")!.getAttribute("aria-label")).toBe("Mise en forme");
    const setLabels = vi.spyOn(editor!, "setLabels");
    render(<MarkdownEditor ref={ref} labels={{ toolbar: "Mise en forme" }} />);
    expect(setLabels).not.toHaveBeenCalled();
    render(<MarkdownEditor ref={ref} labels={{ toolbar: "Format" }} />);
    expect(host.querySelector("[role=toolbar]")!.getAttribute("aria-label")).toBe("Format");
  });

  test("readOnly and shortcuts change in place", () => {
    let editor: EditorHandle | null = null;
    const ref = (handle: EditorHandle | null) => void (editor = handle);
    render(<MarkdownEditor ref={ref} />);
    const view = editor!.view;
    render(<MarkdownEditor ref={ref} readOnly shortcuts={{ bold: ["Mod-Shift-b"] }} />);
    expect(editor!.view).toBe(view);
    expect(view.state.readOnly).toBe(true);
    const setShortcuts = vi.spyOn(editor!, "setShortcuts");
    render(<MarkdownEditor ref={ref} readOnly shortcuts={{ bold: ["Mod-Shift-b"] }} />);
    expect(setShortcuts).not.toHaveBeenCalled();
  });

  test("paste goes to the latest onPaste", () => {
    let editor: EditorHandle | null = null;
    const ref = (handle: EditorHandle | null) => void (editor = handle);
    render(<MarkdownEditor ref={ref} onPaste={() => "first"} />);
    render(<MarkdownEditor ref={ref} onPaste={({ html }) => (html ? "**pasted**" : undefined)} />);
    paste(editor!, "<b>pasted</b>");
    expect(editor!.getValue()).toBe("**pasted**");
  });

  test("an add-on runs with the editor and is undone before the editor goes", () => {
    const seen: string[] = [];
    function Addon() {
      useEditorEffect((editor) => {
        seen.push(`attach ${editor.getValue()}`);
        return () => seen.push(`detach ${editor.view.dom.isConnected}`);
      }, []);
      return null;
    }
    render(
      <MarkdownEditor defaultValue="doc">
        <Addon />
      </MarkdownEditor>,
    );
    render(null);
    expect(seen).toEqual(["attach doc", "detach true"]);
  });

  test("a change to a build option builds the editor again, keeping the doc, the selection and focus", () => {
    let editor: EditorHandle | null = null;
    const ref = (handle: EditorHandle | null) => void (editor = handle);
    render(<MarkdownEditor ref={ref} defaultValue="hello" placeholder="Write" />);
    const first = editor!;
    act(() => {
      first.view.dispatch({ selection: { anchor: 2, head: 4 } });
      first.focus();
    });
    render(<MarkdownEditor ref={ref} defaultValue="hello" placeholder="Write" />);
    expect(editor).toBe(first);
    render(<MarkdownEditor ref={ref} defaultValue="hello" placeholder="Write" lineNumbers={false} />);
    expect(editor).not.toBe(first);
    expect(editor!.getValue()).toBe("hello");
    expect(editor!.view.state.selection.main).toMatchObject({ anchor: 2, head: 4 });
    expect(editor!.view.hasFocus).toBe(true);
    expect(host.querySelectorAll(".cm-editor")).toHaveLength(1);
    expect(host.querySelector(".cm-gutters")).toBeNull();
  });

  test("a toolbar written inline each render isn't a change", () => {
    let editor: EditorHandle | null = null;
    const ref = (handle: EditorHandle | null) => void (editor = handle);
    render(<MarkdownEditor ref={ref} toolbar={[...defaultToolbar, previewButton()]} />);
    const first = editor;
    render(<MarkdownEditor ref={ref} toolbar={[...defaultToolbar, previewButton()]} />);
    expect(editor).toBe(first);
  });

  test("ariaLabel changes in place", () => {
    let editor: EditorHandle | null = null;
    const ref = (handle: EditorHandle | null) => void (editor = handle);
    render(<MarkdownEditor ref={ref} ariaLabel="Notes" />);
    const first = editor!;
    expect(first.view.contentDOM.getAttribute("aria-label")).toBe("Notes");
    render(<MarkdownEditor ref={ref} ariaLabel="Body" />);
    expect(editor).toBe(first);
    expect(first.view.contentDOM.getAttribute("aria-label")).toBe("Body");
    render(<MarkdownEditor ref={ref} />);
    expect(first.view.contentDOM.hasAttribute("aria-label")).toBe(false);
  });

  test("useEditorEffect outside an editor says so", () => {
    function Lost() {
      useEditorEffect(() => {}, []);
      return null;
    }
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Lost />)).toThrow(/inside a <MarkdownEditor>/);
    error.mockRestore();
  });
});

describe("Preview", () => {
  const toolbar = [...defaultToolbar, previewButton()];

  test("renders the doc beside the editor, with the latest render function", async () => {
    let preview: PreviewHandle | null = null;
    const ref = (handle: PreviewHandle | null) => void (preview = handle);
    const tree = (render: (markdown: string) => string) => (
      <MarkdownEditor defaultValue="hello" toolbar={toolbar}>
        <Preview ref={ref} render={render} delay={0} />
      </MarkdownEditor>
    );
    render(tree((markdown) => `<p>${markdown}</p>`));
    await wait();
    expect(preview!.dom.innerHTML).toBe("<p>hello</p>");
    render(tree((markdown) => `<p>${markdown.toUpperCase()}</p>`));
    await act(() => preview!.refresh());
    expect(preview!.dom.innerHTML).toBe("<p>HELLO</p>");
  });

  test("open changes in place, and taking the preview out puts the editor back", async () => {
    let preview: PreviewHandle | null = null;
    const ref = (handle: PreviewHandle | null) => void (preview = handle);
    const tree = (open: boolean, withPreview = true) => (
      <MarkdownEditor defaultValue="x" toolbar={toolbar}>
        {withPreview && <Preview ref={ref} render={(markdown) => markdown} open={open} delay={0} />}
      </MarkdownEditor>
    );
    render(tree(true));
    const first = preview!;
    render(tree(false));
    expect(preview).toBe(first);
    expect(first.isOpen()).toBe(false);
    expect(first.dom.hidden).toBe(true);
    render(tree(false, false));
    expect(host.querySelector(".nme-panes")).toBeNull();
    expect(host.querySelector(".nme-root > .cm-editor")).not.toBeNull();
    await wait();
  });

  test("a rebuild keeps the preview shown or hidden as it was", () => {
    let preview: PreviewHandle | null = null;
    const ref = (handle: PreviewHandle | null) => void (preview = handle);
    const tree = (label: string) => (
      <MarkdownEditor toolbar={toolbar}>
        <Preview ref={ref} render={(markdown) => markdown} label={label} />
      </MarkdownEditor>
    );
    render(tree("Preview"));
    act(() => preview!.toggle());
    render(tree("Aperçu"));
    expect(preview!.dom.getAttribute("aria-label")).toBe("Aperçu");
    expect(preview!.isOpen()).toBe(false);
    expect(host.querySelectorAll(".nme-preview")).toHaveLength(1);
  });

  test("adds its toggle to the default toolbar, and takes it out again", async () => {
    let editor: EditorHandle | null = null;
    const ref = (handle: EditorHandle | null) => void (editor = handle);
    const button = () => host.querySelector('[role=toolbar] [aria-label="Preview"]');
    const tree = (withPreview: boolean) => (
      <MarkdownEditor ref={ref} defaultValue="kept">
        {withPreview && <Preview render={(markdown) => markdown} />}
      </MarkdownEditor>
    );
    render(tree(true));
    const first = editor;
    await act(() => Promise.resolve());
    expect(editor).toBe(first);
    expect(button()).not.toBeNull();
    render(tree(false));
    await act(() => Promise.resolve());
    expect(button()).toBeNull();
    expect(editor!.getValue()).toBe("kept");
    render(tree(true));
    await act(() => Promise.resolve());
    expect(button()).not.toBeNull();
    expect(host.querySelectorAll(".nme-preview")).toHaveLength(1);
  });

  test("leaves a host's own toolbar as it is", async () => {
    render(
      <MarkdownEditor toolbar={defaultToolbar}>
        <Preview render={(markdown) => markdown} />
      </MarkdownEditor>,
    );
    await act(() => Promise.resolve());
    expect(host.querySelector('[role=toolbar] [aria-label="Preview"]')).toBeNull();
  });

  test("Strict Mode leaves one preview", () => {
    render(
      <StrictMode>
        <MarkdownEditor toolbar={toolbar}>
          <Preview render={(markdown) => markdown} />
        </MarkdownEditor>
      </StrictMode>,
    );
    expect(host.querySelectorAll(".nme-preview")).toHaveLength(1);
    expect(host.querySelectorAll(".cm-editor")).toHaveLength(1);
  });
});
