# Nethermark

A small Markdown source editor built on [CodeMirror 6](https://codemirror.net/): a toolbar, formatting commands that toggle on and off, keyboard shortcuts and a theme you can swap.

It edits GitHub-flavored Markdown as plain text. It doesn't render a preview or do rich-text editing.

> Nethermark is in early development and not published yet.

## Packages

| Package | |
| --- | --- |
| [`@netherstone/nethermark`](packages/nethermark) | The editor, with no framework |

## Development

Needs Node 22.12 or later and pnpm.

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm test:browser
```

Changes that affect a published package need a changeset: run `pnpm changeset` and commit the file it writes.

## License

[MIT](LICENSE)
