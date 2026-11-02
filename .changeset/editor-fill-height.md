---
"@netherstone/nethermark": patch
"@netherstone/nethermark-react": patch
---

A height given to the editor now holds: on `.nme-root`, on `<nether-mark>`, or in the React component's `style`. The toolbar stays on top, the text scrolls inside the rest, and the preview matches it. Before, the editor grew past the height, so the page scrolled instead and the end of the text was cut off.
