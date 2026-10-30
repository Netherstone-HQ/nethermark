---
"@netherstone/nethermark": minor
---

Add the toolbar. `createToolbar(view, items)` builds it on its own, for hosts to place anywhere; `defaultToolbar` is the default set and `defineToolbarItem` checks a host's own items. Buttons show pressed from the syntax tree at the cursor in one update pass, show their label and keys for the platform, give focus back to the editor and are disabled while it's read-only. Items that don't fit move into a More menu from the right, and the table menu shows only in a table. The toolbar is one Tab stop with arrow keys, Alt-F10 moves focus to it and Escape goes back. Icons are Phosphor Fill, with its MIT notice in THIRD_PARTY_NOTICES.md.
