---
"@netherstone/nethermark": minor
---

Add support for a host's own Markdown syntax. The `markdownExtensions` option passes Lezer Markdown extensions to the parser, and `defineCommand` takes four kinds that follow the built-in rules: `inline` for a mark like `==` around a node, `line` for a prefix on each line, `fence` for a fenced block with an info string like `mermaid`, and `block` for a header line and a prefix on every line, like a callout.
