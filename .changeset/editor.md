---
"@netherstone/nethermark": minor
---

Add `createMarkdownEditor`, which builds the editor and toolbar in one root and returns a handle (`getValue`, `setValue` as one undo step, `focus`, `run`, `setTheme`, `setReadOnly`, `setShortcuts`, `destroy`), and `markdownEditor`, the same editor as an extension bundle for your own `EditorView`. Options cover the theme (including `"auto"`), line numbers and wrapping, read-only, a placeholder, the text area's label, shortcuts, your own commands by name, host classes for every part, `onChange`, and `onPaste` and `onDrop` hooks whose results can be async. CRLF docs keep their line endings.
