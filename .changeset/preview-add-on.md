---
"@netherstone/nethermark": minor
---

Adds a preview at `@netherstone/nethermark/preview`. `createPreview(view, { render })` shows the doc as HTML beside the editor or in its place, from any renderer you pass, sync or async. HTML goes through a built-in sanitizer unless you pass your own or `sanitize: false`. Rendering waits for a pause in typing, and the two sides scroll together through `data-line` attributes. `previewButton()` is the toolbar toggle and `togglePreview` its command.

Toolbar buttons take `enabledWhenReadOnly`, for commands that don't edit. A menu, More included, stays enabled while any of its items can run.
