---
"@netherstone/nethermark": minor
---

Add theming and styling. A `Theme` is a plain object of tokens, written as `--nme-` custom properties on the editor, and every rule reads only those. `themes.light` and `themes.dark` are neutral presets that pass WCAG AA for text and every syntax token; `extendTheme` changes a few tokens. Syntax, line kinds and markers get stable `nme-` classes, and the package's CSS sits in `@layer nme`, so a plain host rule wins without `!important`.
