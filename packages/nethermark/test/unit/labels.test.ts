import { describe, expect, test } from "vitest";
import { commands, defaultLabels, defaultToolbar, type Labels, type ToolbarItem } from "../../src/index.js";
import { labelsFacet } from "../../src/labels.js";
import { labelOf } from "../../src/toolbar/items.js";
import { formatKeys } from "../../src/toolbar/keys.js";
import { print, stateOf } from "../notation.js";

const french: Labels = { tableColumn: "Colonne {n}", imageAlt: "texte", url: "lien", bold: "Gras", tableMenu: "Tableau" };

function runWith(labels: Labels, command: (typeof commands)[keyof typeof commands], text: string): string {
  let state = stateOf(text, { extensions: [labelsFacet.of(labels)] });
  command({ state, dispatch: (tr) => (state = tr.state) });
  return print(state);
}

describe("labels", () => {
  test("text that commands insert comes from the labels", () => {
    expect(runWith(french, commands.table, "‸")).toBe("| ⟦Colonne 1⟧ | Colonne 2 |\n| --- | --- |\n|  |  |");
    expect(runWith(french, commands.image, "‸")).toBe("![⟦texte⟧](lien)");
    expect(runWith(french, commands.image, "⟦a⟧")).toBe("![a](⟦lien⟧)");
    expect(runWith(french, commands.link, "⟦a⟧")).toBe("[a](⟦lien⟧)");
  });

  test("left out, a label keeps its default", () => {
    const labels = stateOf("‸", { extensions: [labelsFacet.of({ bold: "Gras" })] }).facet(labelsFacet);
    expect(labels).toEqual({ ...defaultLabels, bold: "Gras" });
  });

  test("every built-in toolbar item takes its label from the labels", () => {
    const labels = Object.fromEntries(Object.keys(defaultLabels).map((name) => [name, `<${name}>`])) as Record<keyof typeof defaultLabels, string>;
    const shown = (items: readonly ToolbarItem[]): string[] =>
      items.flatMap((item) => (item === "separator" ? [] : [labelOf(item, labels), ...("menu" in item ? shown(item.menu) : [])]));
    for (const label of shown(defaultToolbar)) expect(label).toMatch(/^<\w+>$/);
    expect(labelOf(defaultToolbar.find((item) => item !== "separator" && "menu" in item) as never, labels)).toBe("<tableMenu>");
  });

  test("a host's own item keeps its own label", () => {
    expect(labelOf({ command: "bold", icon: "B", label: "Mine" }, { ...defaultLabels, bold: "Gras" })).toBe("Mine");
  });

  test("modifier names outside macOS come from the labels", () => {
    const keys = { ...defaultLabels, keyCtrl: "Strg", keyShift: "Umschalt" };
    expect(formatKeys("Mod-Shift-x", false, keys)).toBe("Strg+Umschalt+X");
    expect(formatKeys("Mod-Shift-x", true, keys)).toBe("⇧⌘X");
  });
});
