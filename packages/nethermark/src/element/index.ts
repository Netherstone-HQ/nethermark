import { NetherMarkElement } from "./element.js";

export { NetherMarkElement };

declare global {
  interface HTMLElementTagNameMap {
    "nether-mark": NetherMarkElement;
  }
}

// Importing the entry defines the tag. A page that wants another name extends
// the class under it: `customElements.define("my-editor", class extends NetherMarkElement {})`.
if (typeof customElements !== "undefined" && !customElements.get("nether-mark")) {
  customElements.define("nether-mark", NetherMarkElement);
}
