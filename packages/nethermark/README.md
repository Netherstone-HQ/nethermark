# @netherstone/nethermark

A small Markdown source editor built on [CodeMirror 6](https://codemirror.net/).

Covers all of CommonMark and GitHub-flavored Markdown through commands, with toolbar buttons and shortcuts for the common ones. Writers don't need to know Markdown syntax. Formatting commands toggle on and off.

Ships neutral light and dark themes. Change colors, fonts and sizes with `extendTheme`, or style any part with CSS through its `nme-` class.

Commands read the Markdown syntax tree at the cursor before they edit:

- In `**bold**`, Bold removes the `**`.
- In `` `x**2` ``, the `**` is code, so Bold leaves it as it is.

Versions are 0.x, so a minor release can include breaking API changes. See the [changelog](CHANGELOG.md).

## Install

```bash
npm install @netherstone/nethermark
```

The CodeMirror packages are peer dependencies. npm 7+ and pnpm 8+ install them automatically. With older npm or pnpm, install them with the package:

```bash
npm install @netherstone/nethermark @codemirror/state @codemirror/view @codemirror/commands @codemirror/language @codemirror/lang-markdown @lezer/markdown @lezer/highlight
```

Yarn doesn't install peer dependencies, so add them too:

```bash
yarn add @netherstone/nethermark @codemirror/state @codemirror/view @codemirror/commands @codemirror/language @codemirror/lang-markdown @lezer/markdown @lezer/highlight
```

## Quick start

```ts
import { createMarkdownEditor } from "@netherstone/nethermark";

const editor = createMarkdownEditor({
  parent: document.querySelector("#editor")!,
  doc: "# Hello",
  onChange: (doc) => console.log(doc),
});
```

This renders the toolbar and editor into `#editor`. Styles are injected at runtime, so there's no CSS file to import.

The editor shows Markdown source only. Rendering a preview or converting to HTML is up to the host.

## Options

| Option | Type | Default |
| --- | --- | --- |
| `parent` | `HTMLElement` | required |
| `doc` | `string` | `""` |
| `onChange` | `(doc: string) => void` | none |
| `toolbar` | `ToolbarItem[]` or `false` | `defaultToolbar` |
| `theme` | `Theme`, `"auto"` or `{ light, dark }` | `themes.light` |
| `lineNumbers` | `boolean` | `true` |
| `lineWrapping` | `boolean` | `true` |
| `readOnly` | `boolean` | `false` |
| `placeholder` | `string` | none |
| `ariaLabel` | `string` | none |
| `shortcuts` | keys by command name | the defaults below |
| `commands` | your commands by name | none |
| `classNames` | your classes by part | none |
| `labels` | strings by name | English |
| `onPaste` | `PasteHook` | none |
| `onDrop` | `DropHook` | none |
| `markdownExtensions` | Lezer Markdown extensions | none |
| `extensions` | CodeMirror extensions | none |

- `onChange` fires once per transaction that changes the doc, with the full doc. Debounce it in the host if needed.
- `theme: "auto"` follows `prefers-color-scheme`, switching between `themes.light` and `themes.dark`, or between your `{ light, dark }` pair.
- `ariaLabel` sets the accessible name of the content element.
- `extensions` are appended last and can override the editor's defaults.

## The editor handle

`createMarkdownEditor` returns a handle:

| Member | What it does |
| --- | --- |
| `view` | The CodeMirror `EditorView` |
| `getValue()` | Returns the doc, with its original line endings |
| `setValue(doc)` | Replaces the doc in one undo step |
| `focus()` | Focuses the text area |
| `run(name)` | Runs a command by name |
| `setTheme(theme)` | Swaps the theme. Keeps the cursor and undo history |
| `setReadOnly(on)` | Toggles read-only. Editing buttons are disabled while it's on |
| `setShortcuts(map)` | Rebinds keys. Commands left out keep their defaults |
| `setLabels(map)` | Replaces the labels. Ones left out go back to English |
| `destroy()` | Removes the editor and toolbar from the page |

`setTheme`, `setReadOnly`, `setShortcuts` and `setLabels` reconfigure CodeMirror compartments, so nothing is rebuilt. `run` throws on an unknown command name.

## Commands

Every command applies to all selection ranges and is one undo step. Formatting commands toggle: running one again removes the formatting.

| Command | Default keys |
| --- | --- |
| `bold` | `Mod-b` |
| `italic` | `Mod-i` |
| `strikethrough` | `Mod-Shift-x` |
| `inlineCode` | `Mod-e` |
| `link` | `Mod-k` |
| `heading1` to `heading6` | `Mod-Alt-1` to `Mod-Alt-6` |
| `paragraph` | `Mod-Alt-0` |
| `bulletList` | `Mod-Shift-8` |
| `orderedList` | `Mod-Shift-7` |
| `taskList` | `Mod-Shift-9` |
| `quote` | `Mod-Shift-.` |
| `codeBlock` | `Mod-Alt-8` |
| `indentList`, `outdentList` | `Tab`, `Shift-Tab` in a list |
| `hardBreak` | `Shift-Enter` |
| `horizontalRule`, `table`, `image` | none |
| `toggleTaskDone`, `footnote`, `clearFormatting`, `escapeSelection` | none |
| `convertToReference`, `convertToInline` | none |
| `addRowAbove`, `addRowBelow`, `addColumnLeft`, `addColumnRight` | none |
| `deleteRow`, `deleteColumn`, `formatTable` | none |
| `alignColumnLeft`, `alignColumnCenter`, `alignColumnRight` | none |

`Mod` is Cmd on macOS and Ctrl elsewhere. Enter continues lists, tasks and quotes, from `@codemirror/lang-markdown`. Outside a list, Tab isn't captured, so focus moves out of the editor.

`horizontalRule`, `table` and `image` always insert and don't toggle.

`commands` exports every command as a CodeMirror `StateCommand`, usable with or without the toolbar.

### Change the keys

Keys use CodeMirror's key format. Map a command name to a list of keys, or to `false` to unbind it:

```ts
createMarkdownEditor({
  parent,
  shortcuts: { bold: ["Mod-Shift-b"], italic: false },
});

editor.setShortcuts({ bold: ["Mod-b"] });
```

### Add a command

`defineCommand({ run, isActive })` creates a command. `run(state)` returns a transaction spec, or `null` when the command doesn't apply. `isActive(state)` drives the button's pressed state.

Pass custom commands in the `commands` option. `run`, `shortcuts` and toolbar items then resolve them by name. Commands are registered per editor, so two editors on one page don't clash.

```ts
const upper = defineCommand({
  run: (state) => {
    const { from, to } = state.selection.main;
    if (from === to) return null;
    return { changes: { from, to, insert: state.sliceDoc(from, to).toUpperCase() } };
  },
});

createMarkdownEditor({
  parent,
  commands: { upper },
  shortcuts: { upper: ["Mod-Shift-u"] },
  toolbar: [...defaultToolbar, defineToolbarItem({ command: "upper", icon: "AA", label: "Uppercase" })],
});
```

### Your own Markdown syntax

`defineCommand` also accepts four declarative kinds. They reuse the built-in command rules.

| Kind | Use it for | Example |
| --- | --- | --- |
| `inline: { mark, node }` | A mark around text | `{ inline: { mark: "==", node: "Highlight" } }` |
| `line: { prefix }` | A prefix at the start of a line | `{ line: { prefix: "%% " } }` |
| `fence: info` | A fenced block with an info string | `{ fence: "mermaid" }` |
| `block: { header, prefix }` | A header line, then a prefix on every line | `{ block: { header: "> [!NOTE]", prefix: "> " } }` |

`line`, `fence` and `block` match their syntax by text. `inline` marks are matched in the syntax tree, so the parser must know them: pass a [Lezer Markdown extension](https://github.com/lezer-parser/markdown) in `markdownExtensions`. The marker node defaults to the node name plus `Mark`. This extension parses `==text==`:

```ts
import type { MarkdownConfig } from "@lezer/markdown";

const delimiter = { resolve: "Highlight", mark: "HighlightMark" };

const highlightSyntax: MarkdownConfig = {
  defineNodes: [{ name: "Highlight" }, { name: "HighlightMark" }],
  parseInline: [{
    name: "Highlight",
    after: "Emphasis",
    parse(cx, next, pos) {
      if (next !== 61 || cx.char(pos + 1) !== 61 || cx.char(pos + 2) === 61) return -1;
      const spaceBefore = /\s|^$/.test(cx.slice(pos - 1, pos));
      const spaceAfter = /\s|^$/.test(cx.slice(pos + 2, pos + 3));
      return cx.addDelimiter(delimiter, pos, pos + 2, !spaceAfter, !spaceBefore);
    },
  }],
};

createMarkdownEditor({
  parent,
  markdownExtensions: [highlightSyntax],
  commands: {
    highlight: defineCommand({ inline: { mark: "==", node: "Highlight" } }),
    note: defineCommand({ block: { header: "> [!NOTE]", prefix: "> " } }),
  },
  toolbar: [
    ...defaultToolbar,
    { command: "highlight", icon: "H", label: "Highlight" },
    { command: "note", icon: "N", label: "Note" },
  ],
});
```

## Toolbar

Default items, in order:

Bold, Italic, Strikethrough, Inline code | Heading 1, Heading 2, Heading 3 | Bullet list, Numbered list, Task list, Quote | Link, Image, Code block, Table, Horizontal rule

Headings 4 to 6 always sit in the More menu. The Table menu, with row, column and alignment commands, appears only while the cursor is in a table. Items that don't fit move into More from the right, measured with a `ResizeObserver`.

Buttons set `aria-pressed` from the syntax tree at the cursor, in one update pass. Tooltips show the label and the bound keys for the current platform. On touch screens, where there's no hover, the same text shows above a button while it's pressed.

`defaultToolbar` is exported for reordering or extending. Item shapes:

| Item | Shape |
| --- | --- |
| Button | `{ command, icon, label, shortcut?, inMore?, enabledWhenReadOnly? }` |
| Menu | `{ menu, icon, label, visible?, inMore? }` |
| Separator | `"separator"` |

- `command` is a command name or a command.
- `icon` is an SVG string or plain text, like `H1`.
- `shortcut` lists keys to show in the tooltip of a custom command. Built-in commands show their bound keys.
- `inMore: true` pins the item to the More menu.
- `enabledWhenReadOnly: true` keeps a button enabled in a read-only editor, for a command that doesn't edit the doc.
- `visible(state)` shows the menu only while it returns `true`.

`defineToolbarItem` validates an item and throws on an empty label or icon.

### Use your own EditorView

`markdownEditor(options)` returns the editor as a CodeMirror extension bundle. It takes the same options as `createMarkdownEditor`, minus `parent`, `doc` and `toolbar`.

`createToolbar(view, items?)` attaches a toolbar to any `EditorView` and returns `{ dom, focus(), destroy() }`. Mount `dom` anywhere. It reads keys and theme from the editor state, so it follows `setShortcuts` and `setTheme`.

```ts
import { EditorView } from "@codemirror/view";
import { createToolbar, markdownEditor } from "@netherstone/nethermark";

const view = new EditorView({ parent, extensions: [markdownEditor({ theme: "auto" })] });
const toolbar = createToolbar(view);
parent.prepend(toolbar.dom);
```

## Paste and drop

Plain text pastes unchanged. The package doesn't parse HTML. Two hooks hand HTML and files to the host:

- `onPaste({ html, text, files })` fires when the clipboard holds HTML or files, such as a pasted screenshot. `html` is `""` when there's none. Dropped HTML goes through it too, with no files.
- `onDrop({ files, position })` fires when files are dropped. Dropped text inserts like a paste.

Both return Markdown to insert, nothing to fall back to the default handling, or a promise of either. While a promise is pending, the insert position is mapped through edits made in the meantime.

```ts
createMarkdownEditor({
  parent,
  onDrop: async ({ files }) => {
    const url = await upload(files[0]);
    return `![](${url})`;
  },
});
```

`upload` stands for your own storage code. The same code handles a pasted picture:

```ts
createMarkdownEditor({
  parent,
  onPaste: async ({ files }) => {
    if (files.length === 0) return;
    const url = await upload(files[0]);
    return `![](${url})`;
  },
});
```

## Preview

Preview is optional, and you choose the renderer. It's its own entry point, so the core bundle has none of it.

```ts
import { createMarkdownEditor, defaultToolbar } from "@netherstone/nethermark";
import { createPreview, previewButton } from "@netherstone/nethermark/preview";
import { marked } from "marked";

const editor = createMarkdownEditor({ parent, toolbar: [...defaultToolbar, "separator", previewButton()] });
const preview = createPreview(editor.view, { render: (markdown) => marked.parse(markdown) });
```

`createPreview(view, options)` works on any `EditorView` with the editor bundle. The editor moves into a grid with the preview, which takes the editor's height and scrolls, so give `.cm-editor` a height.

| Option | Default | |
| --- | --- | --- |
| `render(markdown)` | required | Returns HTML, or a promise of it. |
| `sanitize` | built-in | A function that replaces the built-in sanitizer, such as DOMPurify's `sanitize`, returning HTML or nodes. `false` turns sanitizing off. |
| `layout` | `"split"` | `"split"` shows the preview beside the editor. `"tabs"` shows it in the editor's place. |
| `open` | `true` | Whether the preview shows at first. |
| `delay` | the last render's time | Milliseconds to wait after an edit before rendering. |
| `scrollSync` | `true` | Keeps both sides scrolled to the same place. |
| `label` | `"Preview"` | The preview region's accessible name. |
| `onRender(dom)` | | Runs after each render, for work on the rendered DOM such as diagrams or code highlighting. |
| `onError(error)` | `console.error` | Called when `render` or `sanitize` throws. The last good preview stays. |

The handle has `dom`, `isOpen()`, `setOpen(open)`, `toggle()`, `setLayout(layout)`, `refresh()` and `destroy()`. `refresh()` renders again even when the doc hasn't changed, and returns a promise for when it's on the page.

- Renders run one at a time, while the preview shows. Edits during a render wait for it, then the latest doc renders. Without `delay`, the wait after an edit is as long as the last render took.
- The built-in sanitizer keeps the elements and attributes Markdown renders to and removes the rest: script, styles, event handlers, frames, forms, SVG and `javascript:` URLs. Links with a scheme open in a new tab with `rel="noopener noreferrer"`. Pass `sanitize: false` only for HTML from a source you trust.
- Scroll sync reads `data-line` attributes on the rendered elements: the 0-based doc line each one starts on, as markdown-it's `token.map[0]` gives. Without them the two sides scroll on their own.
- In tabs, the editor is read-only while the preview shows, and focus moves to the preview when the editor had it.
- `previewButton({ label?, icon? })` is the toolbar toggle, pressed while the preview shows. It stays enabled in a read-only editor. `togglePreview` is its command, for keys:

```ts
createMarkdownEditor({ parent, commands: { togglePreview }, shortcuts: { togglePreview: ["Mod-Shift-p"] } });
```

## Labels

`labels` replaces any string the package shows or inserts, such as for a translation. Names left out keep their English defaults, which `defaultLabels` exports.

```ts
createMarkdownEditor({
  parent,
  labels: { toolbar: "Mise en forme", bold: "Gras", tableColumn: "Colonne {n}" },
});

editor.setLabels({ bold: "Fett" });
```

| Names | What they label |
| --- | --- |
| `toolbar`, `more`, `tableMenu` | The toolbar's accessible name, the More menu, the table menu |
| One per built-in toolbar item, by command name, such as `bold`, `heading1`, `addRowAbove` | Its tooltip, aria-label and menu text |
| `tableColumn` | A new table's header cells. `{n}` is the column number |
| `imageAlt`, `url` | The placeholders a new image or link gets |
| `keyCtrl`, `keyAlt`, `keyShift`, `keyMeta` | Modifier names in tooltips outside macOS |

Your own toolbar items keep the `label` you give them. `createToolbar` reads the labels from the editor state, so it follows `setLabels` too.

## Themes

A theme is a flat object of tokens: colors, fonts and sizes. Tokens are written as `--nme-` custom properties on the editor root, and the package's CSS reads only those properties.

`themes.light` and `themes.dark` are neutral presets. Their text and syntax colors pass WCAG AA (4.5:1), checked by a test.

`extendTheme(base, overrides)` returns a new theme with some tokens replaced:

```ts
import { extendTheme, themes } from "@netherstone/nethermark";

editor.setTheme(extendTheme(themes.dark, { link: "#7aa2f7", radius: "8px" }));
```

| Group | Tokens |
| --- | --- |
| Surface | `background`, `foreground`, `gutterBackground`, `gutterForeground`, `activeLine`, `selection`, `cursor`, `border` |
| Toolbar | `toolbarBackground`, `buttonForeground`, `buttonHover`, `buttonPressed`, `buttonPressedForeground`, `focusRing`, `separator` |
| Syntax | `heading`, `strong`, `emphasis`, `strike`, `code`, `codeBackground`, `link`, `url`, `quote`, `listMarker`, `taskMarker`, `markup`, `tableBorder`, `comment` |
| Type | `fontFamily`, `monoFamily`, `fontSize`, `lineHeight`, `headingScale` |
| Shape | `radius`, `buttonSize`, `iconSize`, `gap`, `borderWidth`, `focusRingWidth`, `scrollbarThumb`, `scrollbarThumbHover` |

- `scheme` (`"light"` or `"dark"`) sets `color-scheme` and CodeMirror's dark flag.
- `markup` colors syntax characters such as `**`, `#` and `>`.
- `comment` colors HTML comments.
- Heading level n is sized `fontSize × headingScale^(6 − n)`. `1` keeps every line one size. The presets use `1.1`.
- The presets use system sans and mono font stacks. Code, fences and tables use `monoFamily`.

## Styling

Every part has a stable `nme-` class. Class names are public API, so renaming one is a breaking change.

| Part | Classes |
| --- | --- |
| Editor | `nme-root`, `nme-gutter`, `nme-content` |
| Toolbar | `nme-toolbar`, `nme-button`, `nme-separator`, `nme-more`, `nme-menu`, `nme-menu-item` |
| Preview | `nme-panes`, `nme-preview` |
| Lines | `nme-line-h1` to `nme-line-h6`, `nme-line-quote`, `nme-line-list`, `nme-line-task`, `nme-line-fence`, `nme-line-table` |
| Inline | `nme-strong`, `nme-em`, `nme-strike`, `nme-code`, `nme-link`, `nme-markup` |
| Other syntax | `nme-heading`, `nme-url`, `nme-quote`, `nme-comment`, `nme-list-marker`, `nme-task-marker`, `nme-table-border` |

Pressed buttons carry `aria-pressed="true"`.

All package CSS sits in `@layer nme`, so unlayered host rules win without `!important`. The exception is the rules that replace CodeMirror's own unlayered defaults: selection, cursor, active line, gutters and focus outline. Override those through tokens, or with a more specific selector such as `.nme-root .cm-gutters`. The package sets no inline styles besides the custom properties on the root.

`classNames` adds your classes to parts, keyed by class name without the `nme-` prefix:

```ts
createMarkdownEditor({ parent, classNames: { strong: "font-black", "line-h1": "tracking-tight" } });
```

## Accessibility

- The toolbar has `role="toolbar"` and one Tab stop. Arrow keys, Home and End move between buttons.
- Alt-F10 moves focus from the editor to the toolbar. Escape moves it back.
- The More menu is a menu with `aria-expanded` and arrow keys.
- Focus rings come from the `focusRing` token and are never removed.
- Clicking or tapping a button runs its command and keeps focus and the selection in the editor, so a phone's keyboard stays up.
- A menu opened by a click or tap leaves focus in the editor, and Escape there closes it. Opened from the keyboard, focus moves into the menu.
- Open menus stay on screen: they open toward the side with more room and scroll when taller than the space below, down to the on-screen keyboard.

## Browsers

Tested with Playwright in Chromium, Firefox and WebKit, and on emulated phones: Android on Chromium and iPhone on WebKit.

## License

[MIT](LICENSE). Toolbar icons are from [Phosphor Icons](https://phosphoricons.com), also MIT. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
