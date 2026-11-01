# Nethermark

A small Markdown source editor built on [CodeMirror 6](https://codemirror.net/).

Covers all of CommonMark and GitHub-flavored Markdown through commands, with toolbar buttons and shortcuts for the common ones. Ships Netherstone's Light and Dark themes, and every part can be restyled with tokens or CSS.

Versions are 0.x, so a minor release can include breaking API changes.

## Packages

| Package | Usage |
| --- | --- |
| [`@netherstone/nethermark`](packages/nethermark) | Full control from JavaScript or TypeScript, with no framework. [npm](https://www.npmjs.com/package/@netherstone/nethermark) |
| [`<nether-mark>`](packages/nethermark#web-component), from `@netherstone/nethermark/element` | Plain HTML, Vue, Svelte, Angular, and forms that used a `<textarea>`. It's an entry point of the package above |
| [`@netherstone/nethermark-react`](packages/nethermark-react) | React 18 and 19. On React 19 the web component works too |

Usage, options and the full API are in each package's README.

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
| `pnpm test:browser` | Playwright tests in Chromium, Firefox and WebKit, and the React tests in Chromium |

Install the browsers before the first browser test run:

```bash
pnpm --filter @netherstone/nethermark exec playwright install chromium firefox webkit
```

The React tests run on React 19. Set `REACT=18` to run them on React 18:

```bash
REACT=18 pnpm --filter @netherstone/nethermark-react test:browser
```

## Releases

A change that affects a published package needs a changeset. Run `pnpm changeset` and commit the file it writes.

To release, a PR runs `pnpm changeset version`, which bumps versions and writes each CHANGELOG. Merging it makes the Release workflow publish to npm with provenance, push the tags and create a GitHub Release for each version.

## License

[MIT](LICENSE)
