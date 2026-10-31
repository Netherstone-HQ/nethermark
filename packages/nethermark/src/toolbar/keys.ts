import { defaultLabels, type LabelName } from "../labels.js";

type KeyLabels = Readonly<Pick<Record<LabelName, string>, "keyCtrl" | "keyAlt" | "keyShift" | "keyMeta">>;

/** Whether keys are shown the Mac way, with symbols. CodeMirror's Mod is ⌘ there and Ctrl elsewhere. */
export const isMac = typeof navigator !== "undefined" && /Mac|iP(hone|[oa]d)/.test(navigator.platform);

/** Mac modifier symbols, in Apple's order. */
const MAC: ReadonlyArray<[string, string]> = [
  ["Ctrl", "⌃"],
  ["Alt", "⌥"],
  ["Shift", "⇧"],
  ["Mod", "⌘"],
  ["Meta", "⌘"],
];

/** Modifier names elsewhere, in the usual order, read from the labels. */
const other = (labels: KeyLabels): ReadonlyArray<[string, string]> => [
  ["Mod", labels.keyCtrl],
  ["Ctrl", labels.keyCtrl],
  ["Meta", labels.keyMeta],
  ["Alt", labels.keyAlt],
  ["Shift", labels.keyShift],
];

/** A key name as it reads on a keyboard: letters in capitals, named keys as named. */
function keyLabel(key: string): string {
  return key.length === 1 ? key.toUpperCase() : key;
}

/** CodeMirror keys such as `Mod-Shift-x` as a person reads them: `⇧⌘X` on a Mac, `Ctrl+Shift+X` elsewhere. */
export function formatKeys(keys: string, mac = isMac, labels: KeyLabels = defaultLabels): string {
  const parts = keys.split(/-(?!$)/);
  const key = keyLabel(parts.pop() ?? "");
  const held = new Set(parts.map((part) => (part === "Cmd" ? "Meta" : part === "Control" ? "Ctrl" : part)));
  const order = mac ? MAC : other(labels);
  const modifiers = order.filter(([name]) => held.has(name)).map(([, label]) => label);
  const unique = [...new Set(modifiers)];
  return mac ? unique.join("") + key : [...unique, key].join("+");
}
