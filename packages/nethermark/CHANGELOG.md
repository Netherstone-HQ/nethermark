# @netherstone/nethermark

## 0.2.0

### Minor Changes

- b7a8a1c: Adds `<nether-mark>`, the editor as a form field, at `@netherstone/nethermark/element`. Importing it defines the tag; `NetherMarkElement` is the class, to extend under another name. It renders in the light DOM, so page CSS and the `nme` layer style it. Simple options are attributes and properties (`value`, `name`, `placeholder`, `theme`, `readonly`, `disabled`, `required`, `aria-label`, `line-numbers`, `line-wrapping`, `toolbar`); commands, extensions, hooks, strings (the `labels` option), icons, shortcuts and the `preview` add-on are properties. It fires `input` and `change` like a `<textarea>`, takes part in its form with reset and validation, takes its name from its `<label>`, and is built when it joins the page and destroyed when it leaves.
- 310358d: The toolbar icons are now Phosphor's regular weight. An `icons` option and `setIcons()` replace any of them with an SVG string or text: the built-in buttons, More, the table menu and its items, and the preview button. `defaultIcons` exports the defaults. Every Phosphor weight is a full set to pass as is, from `@netherstone/nethermark/icons/regular`, `/fill`, `/bold`, `/light` or `/thin`.
  
  The editor, toolbar and preview keep their look on pages with a CSS reset, like Tailwind 4's preflight. The `nme` layer is now added after the page's own sheets, so it sits above a host's base layer. To let utility classes beat it too, name the order first: `@layer theme, base, nme, components, utilities;`. The preview now draws its own headings, spacing and list markers.
- 5f0512a: Adds a `labels` option and `setLabels()` for every string the package shows or inserts: toolbar tooltips and aria-labels, "More", "Formatting", the table menu, new table headers, link and image placeholders, and modifier key names. `defaultLabels` exports the English defaults.
  
  `onPaste` now fires for pasted files too, such as a screenshot, and gets them as `files`. `html` is `""` when the clipboard has no HTML, so a hook that only handles HTML should return nothing when it's empty.
- 3c70b1c: Works on touch screens. Tapping a toolbar button or menu keeps focus and the selection in the editor, so a phone's keyboard stays up. A pressed button shows its label, in place of the hover tooltip. Menus open toward the side with more room and scroll when taller than the space below. Hover colors only apply where there's hover. Escape in the editor closes a menu opened by a click or tap.
- e0ce24f: Adds a preview at `@netherstone/nethermark/preview`. `createPreview(view, { render })` shows the doc as HTML beside the editor or in its place, from any renderer you pass, sync or async. HTML goes through a built-in sanitizer unless you pass your own or `sanitize: false`. Rendering waits for a pause in typing, and the two sides scroll together through `data-line` attributes. `previewButton()` is the toolbar toggle and `togglePreview` its command.
  
  Toolbar buttons take `enabledWhenReadOnly`, for commands that don't edit. A menu, More included, stays enabled while any of its items can run.

## 0.1.2

### Patch Changes

- 05850cc: Publish with a provenance attestation.

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
