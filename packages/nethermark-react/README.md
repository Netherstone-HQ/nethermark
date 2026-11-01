# @netherstone/nethermark-react

A React component for [nethermark](../nethermark), a small Markdown source editor built on [CodeMirror 6](https://codemirror.net/). Works with React 18 and 19.

The component wraps the vanilla editor, so options, commands, themes, labels and icons are the same. They're documented in the [nethermark README](../nethermark/README.md).

Versions are 0.x, so a minor release can include breaking API changes. See the [changelog](CHANGELOG.md).

## Install

```bash
npm install @netherstone/nethermark-react @netherstone/nethermark
```

`@netherstone/nethermark`, `react` and the CodeMirror packages are peer dependencies. npm 7+ and pnpm 8+ install them automatically. With Yarn or older npm, install the CodeMirror packages listed in the [nethermark install steps](../nethermark/README.md#install) too.

## Quick start

```tsx
import { MarkdownEditor } from "@netherstone/nethermark-react";
import { useState } from "react";

export function Editor() {
  const [value, setValue] = useState("# Hello");
  return <MarkdownEditor value={value} onChange={setValue} theme="auto" />;
}
```

Styles are injected at runtime, so there's no CSS file to import.

## MarkdownEditor

`<MarkdownEditor>` takes every [editor option](../nethermark/README.md#options) as a prop, except `parent`, `doc` and `onChange`, which it replaces:

| Prop | Type | |
| --- | --- | --- |
| `value` | `string` | The doc, for a controlled editor. A new value goes in as one undo step |
| `defaultValue` | `string` | The doc to start with, for an uncontrolled editor |
| `onChange` | `(value: string) => void` | Called with the whole doc after each edit. Not called when a new `value` goes in |
| `className`, `style` | | On the element that holds the editor |
| `children` | | Add-ons, such as `<Preview>` |

- A controlled editor doesn't set its own edit back on itself, so typing keeps the cursor and undo history.
- The doc is only copied out of the editor when there's an `onChange`. For a large doc, leave it out and read the doc through the ref when you need it.
- `theme`, `readOnly`, `shortcuts`, `labels`, `icons` and `ariaLabel` change in place. `onPaste` and `onDrop` can change any time.
- A change to any other option builds the editor again, keeping the doc, the selection and focus, but not undo history.
- Plain objects and lists match by their items, so `labels` or a `toolbar` list written inline each render aren't a change. Extensions and commands made in render are new each time: make them once, outside the component or with `useMemo`.
- Strict Mode's second mount is fine.

### The ref

The ref is the vanilla [editor handle](../nethermark/README.md#the-editor-handle), or `null` before the editor is built:

```tsx
import type { MarkdownEditor as EditorHandle } from "@netherstone/nethermark";
import { MarkdownEditor } from "@netherstone/nethermark-react";
import { useRef } from "react";

export function Editor() {
  const editor = useRef<EditorHandle>(null);
  return (
    <>
      <button onClick={() => editor.current?.run("bold")}>Bold</button>
      <MarkdownEditor ref={editor} defaultValue="# Hello" />
    </>
  );
}
```

## Preview

`<Preview>` from `@netherstone/nethermark-react/preview` adds the [preview](../nethermark/README.md#preview) inside a `<MarkdownEditor>`. You bring the renderer. HTML goes through the built-in sanitizer unless you pass your own or `sanitize={false}`.

```tsx
import { MarkdownEditor } from "@netherstone/nethermark-react";
import { Preview } from "@netherstone/nethermark-react/preview";
import { marked } from "marked";

<MarkdownEditor defaultValue="# Hello" style={{ height: 400 }}>
  <Preview render={(markdown) => marked.parse(markdown)} layout="split" />
</MarkdownEditor>;
```

- Its props are the preview options. Give the editor a height, since the preview takes it and scrolls.
- Its toggle joins the default toolbar. With your own `toolbar`, add `previewButton()` to it, also exported from `@netherstone/nethermark-react/preview`.
- `render`, `sanitize` and the callbacks can change any time. `open` and `layout` change in place.
- A change to `delay`, `scrollSync`, `label`, or to which kind of `sanitize` it is (built in, your own or off), builds the preview again, shown or hidden as it was.
- The ref is the preview's handle, for `toggle()`, `setLayout()` and `refresh()`.

## Your own add-ons

`useEditorEffect(effect, deps)` runs `effect` with the editor of the `<MarkdownEditor>` it's inside, like `useEffect`. It runs again when `deps` change or the editor is built again, with the cleanup it returns in between. It waits for the editor, and its cleanup runs before the editor is destroyed.

```tsx
import { useEditorEffect } from "@netherstone/nethermark-react";

function AutoFocus() {
  useEditorEffect((editor) => editor.focus(), []);
  return null;
}

<MarkdownEditor defaultValue="# Hello">
  <AutoFocus />
</MarkdownEditor>;
```

`useToolbarItems(items)` adds items to the end of the default toolbar while the component that calls it is mounted, the way `<Preview>` adds its toggle. Make the list once, outside the component or with `useMemo`.

Both throw when they're not inside a `<MarkdownEditor>`.

## License

[MIT](LICENSE)
