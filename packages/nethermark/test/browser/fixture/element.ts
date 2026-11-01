import "../../../src/element/index.js";
import { NetherMarkElement } from "../../../src/element/index.js";

/** The page the element tests drive: events the field fires, and what the form sends. */
declare global {
  interface Window {
    field: NetherMarkElement;
    NetherMarkElement: typeof NetherMarkElement;
    events: string[];
    formData(): Record<string, string>;
  }
}

window.NetherMarkElement = NetherMarkElement;
window.field = document.getElementById("field") as NetherMarkElement;
window.events = [];
for (const type of ["input", "change"]) window.field.addEventListener(type, () => window.events.push(type));
const form = document.getElementById("form") as HTMLFormElement;
form.addEventListener("submit", (event) => event.preventDefault());
window.formData = () => Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, typeof value === "string" ? value : value.name]));
