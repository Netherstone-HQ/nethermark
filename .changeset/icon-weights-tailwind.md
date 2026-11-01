---
"@netherstone/nethermark": minor
---

The toolbar icons are now Phosphor's regular weight. An `icons` option and `setIcons()` replace any of them with an SVG string or text: the built-in buttons, More, the table menu and its items, and the preview button. `defaultIcons` exports the defaults. Every Phosphor weight is a full set to pass as is, from `@netherstone/nethermark/icons/regular`, `/fill`, `/bold`, `/light` or `/thin`.

The editor, toolbar and preview keep their look on pages with a CSS reset, like Tailwind 4's preflight. The `nme` layer is now added after the page's own sheets, so it sits above a host's base layer. To let utility classes beat it too, name the order first: `@layer theme, base, nme, components, utilities;`. The preview now draws its own headings, spacing and list markers.
