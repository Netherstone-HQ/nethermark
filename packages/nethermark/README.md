# @netherstone/nethermark

A small Markdown source editor built on [CodeMirror 6](https://codemirror.net/): a toolbar, formatting commands that toggle on and off, keyboard shortcuts, and a theme you can swap. It edits GitHub-flavored Markdown as plain text.

It reads the Markdown syntax tree to decide what's already there, so `**` inside code is never mistaken for bold. It doesn't render a preview: turning Markdown into HTML stays with your page.

> Not published to npm yet.

## Install

CodeMirror is a peer dependency, so a CodeMirror fix reaches you without a release of this package.

```bash
npm install @netherstone/nethermark @codemirror/state @codemirror/view @codemirror/commands @codemirror/language @codemirror/lang-markdown @lezer/markdown @lezer/highlight
```

## Use

```ts
import { createMarkdownEditor } from "@netherstone/nethermark";

const editor = createMarkdownEditor({
  parent: document.querySelector("#editor")!,
  doc: "# Hello",
  onChange: (doc) => save(doc),
});

editor.run("bold");
editor.getValue();
```

### Options

| Option | Type | Default |
| --- | --- | --- |
| `parent` | `HTMLElement` | required |
| `doc` | `string` | `""` |
| `onChange` | `(doc: string) => void`, once per change | none |
| `toolbar` | `ToolbarItem[]` or `false` | `defaultToolbar` |
| `theme` | `Theme`, `"auto"`, or `{ light, dark }` | `themes.light` |
| `lineNumbers` | `boolean` | `true` |
| `lineWrapping` | `boolean` | `true` |
| `readOnly` | `boolean` | `false` |
| `placeholder` | `string` | none |
| `ariaLabel` | `string`, the text area's accessible name | none |
| `shortcuts` | keys per command name, or `false` for none | the defaults below |
| `commands` | your own commands by name | none |
| `classNames` | your classes per part, such as `{ strong: "font-black" }` | none |
| `onPaste` | `({ html, text }) => Markdown`, for pasted HTML | none |
| `onDrop` | `({ files, position }) => Markdown`, for dropped files | none |
| `extensions` | more CodeMirror extensions, added last | none |

`theme: "auto"` follows the system's light or dark preference, and `{ light, dark }` does the same with your two themes.

`onPaste` and `onDrop` can return a string, nothing (for the editor's own handling), or a promise of either. While a promise is pending, the insert point moves with any edits made meanwhile.

### The handle

| Member | |
| --- | --- |
| `view` | the CodeMirror `EditorView` |
| `getValue()` | the doc, with the line endings it came in with |
| `setValue(doc)` | replaces the doc as one undo step |
| `focus()` | |
| `run(name)` | runs a command by name, yours or built in |
| `setTheme(theme)` | keeps the cursor and undo history |
| `setReadOnly(on)` | |
| `setShortcuts(map)` | commands left out keep their defaults |
| `destroy()` | takes the editor and toolbar out of the page |

### Your own `EditorView`

`markdownEditor(options)` returns the editor as an extension bundle. It takes the same options except `parent`, `doc` and `toolbar`. `createToolbar(view, items)` builds the toolbar on its own, for you to place anywhere.

```ts
const view = new EditorView({ parent, extensions: [markdownEditor({ theme: "auto" })] });
const toolbar = createToolbar(view);
parent.prepend(toolbar.dom);
```

## Commands

`commands` holds every command as a plain CodeMirror `StateCommand`, so it works with or without the toolbar. Each one makes one undo step and works on every selection range, and the formatting ones toggle: run one again and the formatting comes off.

| Command | Keys |
| --- | --- |
| `bold`, `italic`, `strikethrough`, `inlineCode`, `link` | Mod-B, Mod-I, Mod-Shift-X, Mod-E, Mod-K |
| `heading1` … `heading6`, `paragraph` | Mod-Alt-1 … Mod-Alt-6, Mod-Alt-0 |
| `bulletList`, `orderedList`, `taskList`, `quote` | Mod-Shift-8, Mod-Shift-7, Mod-Shift-9, Mod-Shift-. |
| `codeBlock` | Mod-Alt-8 |
| `indentList`, `outdentList` | Tab, Shift-Tab, in lists |
| `hardBreak` | Shift-Enter |
| `horizontalRule`, `table`, `image`, `toggleTaskDone`, `footnote`, `convertToReference`, `convertToInline`, `escapeSelection`, `clearFormatting` | none |
| `addRowAbove`, `addRowBelow`, `addColumnLeft`, `addColumnRight`, `deleteRow`, `deleteColumn`, `alignColumnLeft`, `alignColumnCenter`, `alignColumnRight`, `formatTable` | none; in the toolbar's table menu |

Mod is ⌘ on a Mac and Ctrl elsewhere. Keys use CodeMirror's format, so `shortcuts: { bold: ["Mod-Shift-b"], italic: false }` changes Bold and takes Italic's keys off.

Make your own with `defineCommand({ run, isActive })`, where `run` returns the transaction to make, or `null` when the command doesn't apply. Pass yours in `commands`, and toolbar items, `run` and `shortcuts` find them by name:

```ts
const shout = defineCommand({
  run: (state) => {
    const { from, to } = state.selection.main;
    return from === to ? null : { changes: { from, to, insert: state.sliceDoc(from, to).toUpperCase() } };
  },
});

createMarkdownEditor({
  parent,
  commands: { shout },
  shortcuts: { shout: ["Mod-u"] },
  toolbar: [...defaultToolbar, defineToolbarItem({ command: "shout", icon: "!", label: "Shout" })],
});
```

## Toolbar

A toolbar item is a button `{ command, icon, label, shortcut? }`, a menu `{ menu, icon, label, visible? }`, or `"separator"`. An icon is an SVG string or plain text. `inMore: true` keeps an item in the More menu. Items that don't fit the width move into More, from the right.

Keyboard: the toolbar is one Tab stop, with arrow keys, Home and End along it. Alt-F10 moves focus from the editor to the toolbar, and Escape goes back.

## Theming and styling

A theme is a plain object of tokens: colors, fonts and sizes. The package writes them as `--nme-` custom properties, and all of its CSS reads them. `themes.light` and `themes.dark` are neutral, and pass WCAG AA contrast for text and every syntax token. Change a few tokens with `extendTheme`:

```ts
const theme = extendTheme(themes.dark, { link: "#7aa2f7", radius: "8px" });
editor.setTheme(theme);
```

Every part has a stable class: `nme-root`, `nme-toolbar`, `nme-button`, `nme-gutter`, `nme-content`, line kinds like `nme-line-h1` and `nme-line-quote`, and syntax like `nme-strong` and `nme-link`. The package's CSS sits in `@layer nme`, so your own rules win without `!important`. The exception is the few rules that replace CodeMirror's own defaults (selection, cursor, active line, gutters, focus outline): change those through tokens, or with a more specific selector.

## License

[MIT](LICENSE). The toolbar icons are from [Phosphor Icons](https://phosphoricons.com), MIT: see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
