import { describe, expect, test } from "vitest";
import { defaultIcons, defaultToolbar, type IconName, type ToolbarItem } from "../../src/index.js";
import { iconsFacet } from "../../src/icons.js";
import { icons as bold } from "../../src/icons/bold.js";
import { icons as fill } from "../../src/icons/fill.js";
import { icons as light } from "../../src/icons/light.js";
import { icons as regular } from "../../src/icons/regular.js";
import { icons as thin } from "../../src/icons/thin.js";
import { previewButton } from "../../src/preview/index.js";
import { iconOf } from "../../src/toolbar/items.js";
import { stateOf } from "../notation.js";

const weights = { regular, fill, bold, light, thin };

/** Every icon as `<name>`, to see which name each item draws. */
const named = Object.fromEntries(Object.keys(defaultIcons).map((name) => [name, `<${name}>`])) as Record<IconName, string>;

describe("icons", () => {
  test("left out, an icon keeps its default", () => {
    const icons = stateOf("‸", { extensions: [iconsFacet.of({ bold: "B" })] }).facet(iconsFacet);
    expect(icons).toEqual({ ...defaultIcons, bold: "B" });
  });

  test("the defaults are Phosphor's regular weight", () => {
    expect(defaultIcons).toMatchObject(regular);
  });

  test("every built-in toolbar item, menus and their items too, takes its icon from the icons", () => {
    const drawn = (items: readonly ToolbarItem[]): string[] =>
      items.flatMap((item) => (item === "separator" ? [] : [iconOf(item, named), ...("menu" in item ? drawn(item.menu) : [])]));
    const icons = drawn(defaultToolbar);
    for (const icon of icons) expect(icon).toMatch(/^<\w+>$/);
    expect(icons).toContain("<tableMenu>");
    expect(icons).toContain("<formatTable>");
  });

  test("the preview button draws the preview icon, unless it was given its own", () => {
    expect(iconOf(previewButton(), named)).toBe("<preview>");
    expect(iconOf(previewButton({ icon: "P" }), named)).toBe("P");
  });

  test("a host's own item keeps its own icon", () => {
    expect(iconOf({ command: "bold", icon: "B", label: "Mine" }, named)).toBe("B");
  });

  test("each weight is a full set of the same SVG icons", () => {
    for (const [weight, icons] of Object.entries(weights)) {
      expect(Object.keys(icons), weight).toEqual(Object.keys(regular));
      for (const svg of Object.values(icons)) expect(svg, weight).toMatch(/^<svg class="nme-icon" aria-hidden="true" focusable="false" /);
    }
  });
});
