import { Facet } from "@codemirror/state";
import { icons as regular } from "./icons/regular.js";

/**
 * Every icon the package draws, by name: the built-in toolbar buttons, More,
 * the table menu and its items, and the preview button. The defaults are
 * Phosphor's regular weight, with text for the table menu's items. Hosts
 * replace them with the `icons` option, or `setIcons` later, with an SVG
 * string or text for each. Each Phosphor weight is a full set to pass as is,
 * from `@netherstone/nethermark/icons/<weight>`.
 */
export const defaultIcons = Object.freeze({
  ...regular,
  addRowAbove: "↑",
  addRowBelow: "↓",
  addColumnLeft: "←",
  addColumnRight: "→",
  deleteRow: "−",
  deleteColumn: "−",
  alignColumnLeft: "⇤",
  alignColumnCenter: "↔",
  alignColumnRight: "⇥",
  formatTable: "⌗",
});

export type IconName = keyof typeof defaultIcons;

/** Icons to replace, by name, each an SVG string or text. Ones left out keep their defaults. */
export type Icons = { readonly [name in IconName]?: string };

/** The icons in this editor: the defaults, with the host's on top. */
export const iconsFacet = Facet.define<Icons, Readonly<Record<IconName, string>>>({
  combine: (values) => Object.assign({}, defaultIcons, ...values) as Record<IconName, string>,
});
