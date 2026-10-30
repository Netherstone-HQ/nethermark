---
"@netherstone/nethermark": minor
---

Add the formatting commands: bold, italic, strikethrough, inline code, link, headings 1 to 6, paragraph, bullet, numbered and task lists, quote, code block, horizontal rule, table and image. Each is a CodeMirror `StateCommand` driven by the Markdown syntax tree, makes one undo step, and works on every selection range. `defineCommand` makes custom commands that follow the same rules.
