import { describe, expect, test } from "vitest";
import { commands, defaultToolbar, defineToolbarItem, type ToolbarItem } from "../../src/index.js";

const labels = (items: readonly ToolbarItem[]) => items.map((item) => (item === "separator" ? "|" : item.label));

describe("toolbar items", () => {
  test("the default set is in the spec's order, with headings 4 to 6 in More", () => {
    expect(labels(defaultToolbar)).toEqual([
      "Bold", "Italic", "Strikethrough", "Inline code", "|",
      "Heading 1", "Heading 2", "Heading 3", "|",
      "Bullet list", "Numbered list", "Task list", "Quote", "|",
      "Link", "Image", "Code block", "Table", "Table", "Horizontal rule",
      "Heading 4", "Heading 5", "Heading 6",
    ]);
    const inMore = defaultToolbar.filter((item) => item !== "separator" && item.inMore);
    expect(labels(inMore)).toEqual(["Heading 4", "Heading 5", "Heading 6"]);
  });

  test("every button names a real command", () => {
    const walk = (items: readonly ToolbarItem[]): string[] =>
      items.flatMap((item) => (item === "separator" ? [] : "menu" in item ? walk(item.menu) : [item.command as string]));
    for (const name of walk(defaultToolbar)) expect(commands).toHaveProperty(name);
  });

  test("a host's item needs a label and an icon", () => {
    const item = defineToolbarItem({ command: commands.bold, icon: "B", label: "Strong" });
    expect(item.label).toBe("Strong");
    expect(Object.isFrozen(item)).toBe(true);
    expect(() => defineToolbarItem({ command: "bold", icon: "B", label: " " })).toThrow(/label/);
    expect(() => defineToolbarItem({ command: "bold", icon: "", label: "Bold" })).toThrow(/icon/);
  });
});
