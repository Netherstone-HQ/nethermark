---
"@netherstone/nethermark": minor
---

Adds a `labels` option and `setLabels()` for every string the package shows or inserts: toolbar tooltips and aria-labels, "More", "Formatting", the table menu, new table headers, link and image placeholders, and modifier key names. `defaultLabels` exports the English defaults.

`onPaste` now fires for pasted files too, such as a screenshot, and gets them as `files`. `html` is `""` when the clipboard has no HTML, so a hook that only handles HTML should return nothing when it's empty.
