---
"@netherstone/nethermark": minor
---

Adds `<nether-mark>`, the editor as a form field, at `@netherstone/nethermark/element`. Importing it defines the tag; `NetherMarkElement` is the class, to extend under another name. It renders in the light DOM, so page CSS and the `nme` layer style it. Simple options are attributes and properties (`value`, `name`, `placeholder`, `theme`, `readonly`, `disabled`, `required`, `aria-label`, `line-numbers`, `line-wrapping`, `toolbar`); commands, extensions, hooks, strings (the `labels` option), shortcuts and the `preview` add-on are properties. It fires `input` and `change` like a `<textarea>`, takes part in its form with reset and validation, takes its name from its `<label>`, and is built when it joins the page and destroyed when it leaves.
