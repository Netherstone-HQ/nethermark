# @netherstone/nethermark

## 0.1.1

### Patch Changes

- 419b4f1: Rewrite the README: install for each package manager, every option, the handle, all commands and keys, toolbar items, paste and drop, theme tokens, classes and accessibility.

## 0.1.0

### Minor Changes

- 66aa4c9: Add support for a host's own Markdown syntax. The `markdownExtensions` option passes Lezer Markdown extensions to the parser, and `defineCommand` takes four kinds that follow the built-in rules: `inline` for a mark like `==` around a node, `line` for a prefix on each line, `fence` for a fenced block with an info string like `mermaid`, and `block` for a header line and a prefix on every line, like a callout.
- 54a6bdd: Add `createMarkdownEditor`, which builds the editor and toolbar in one root and returns a handle (`getValue`, `setValue` as one undo step, `focus`, `run`, `setTheme`, `setReadOnly`, `setShortcuts`, `destroy`), and `markdownEditor`, the same editor as an extension bundle for your own `EditorView`. Options cover the theme (including `"auto"`), line numbers and wrapping, read-only, a placeholder, the text area's label, shortcuts, your own commands by name, host classes for every part, `onChange`, and `onPaste` and `onDrop` hooks whose results can be async. CRLF docs keep their line endings.
- fb8d426: Add the formatting commands: bold, italic, strikethrough, inline code, link, headings 1 to 6, paragraph, bullet, numbered and task lists, quote, code block, horizontal rule, table and image. Each is a CodeMirror `StateCommand` driven by the Markdown syntax tree, makes one undo step, and works on every selection range. `defineCommand` makes custom commands that follow the same rules.
- d83b7f8: Add the rest of the commands, so every CommonMark and GFM construct has one: indentList and outdentList (Tab and Shift-Tab in lists), toggleTaskDone, the table commands (add and delete rows and columns, align a column left, center or right, format the table), hardBreak (Shift-Enter), footnote, convertToReference and convertToInline, escapeSelection and clearFormatting.
- 6d96e5a: Add theming and styling. A `Theme` is a plain object of tokens, written as `--nme-` custom properties on the editor, and every rule reads only those. `themes.light` and `themes.dark` are neutral presets that pass WCAG AA for text and every syntax token; `extendTheme` changes a few tokens. Syntax, line kinds and markers get stable `nme-` classes, and the package's CSS sits in `@layer nme`, so a plain host rule wins without `!important`.
- 4845cee: Add the toolbar. `createToolbar(view, items)` builds it on its own, for hosts to place anywhere; `defaultToolbar` is the default set and `defineToolbarItem` checks a host's own items. Buttons show pressed from the syntax tree at the cursor in one update pass, show their label and keys for the platform, give focus back to the editor and are disabled while it's read-only. Items that don't fit move into a More menu from the right, and the table menu shows only in a table. The toolbar is one Tab stop with arrow keys, Alt-F10 moves focus to it and Escape goes back. Icons are Phosphor Fill, with its MIT notice in THIRD_PARTY_NOTICES.md.
