# Nethermark

A small Markdown source editor built on [CodeMirror 6](https://codemirror.net/).

Covers all of CommonMark and GitHub-flavored Markdown through commands, with toolbar buttons and shortcuts for the common ones. Ships neutral light and dark themes, and every part can be restyled with tokens or CSS.

Versions are 0.x, so a minor release can include breaking API changes.

## Packages

| Package | Description |
| --- | --- |
| [`@netherstone/nethermark`](packages/nethermark) | The editor, toolbar and themes, in plain TypeScript with no framework dependency. [npm](https://www.npmjs.com/package/@netherstone/nethermark) |

Usage, options and the full API are in the [package README](packages/nethermark/README.md).

## Development

Requires Node 22.12 or later and pnpm.

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm test:browser
```

| Command | Runs |
| --- | --- |
| `pnpm lint` | ESLint on the whole repo |
| `pnpm typecheck` | TypeScript in every package |
| `pnpm build` | Builds every package to `dist` |
| `pnpm test` | Vitest unit tests. Commands are tested on `EditorState` alone, without a DOM |
| `pnpm test:browser` | Playwright tests in Chromium, Firefox and WebKit |

Install the browsers before the first browser test run:

```bash
pnpm --filter @netherstone/nethermark exec playwright install chromium firefox webkit
```

## Releases

A change that affects a published package needs a changeset. Run `pnpm changeset` and commit the file it writes.

To release, a PR runs `pnpm changeset version`, which bumps versions and writes each CHANGELOG. Merging it makes the Release workflow publish to npm with provenance, push the tags and create a GitHub Release for each version.

## License

[MIT](LICENSE)
