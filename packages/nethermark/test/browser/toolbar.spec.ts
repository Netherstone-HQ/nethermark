import { devices, expect, test, type Page } from "@playwright/test";
import { themes } from "../../src/theme/index.js";

function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

async function mount(page: Page, doc: string, options: { readOnly?: boolean; width?: string } = {}) {
  await page.goto("/");
  await page.evaluate(([d, o]) => window.mount(d, { toolbar: true, ...(o as object) }), [doc, options] as const);
}

/** Places the editor's cursor at a doc position. */
async function cursorAt(page: Page, pos: number) {
  await page.evaluate((p) => window.view!.dispatch({ selection: { anchor: p } }), pos);
}

const doc = (page: Page) => page.evaluate(() => window.view!.state.doc.toString());
const button = (page: Page, label: string) => page.locator(`.nme-toolbar > .nme-button[aria-label="${label}"]`);

test("clicking a button runs its command and gives focus back to the editor", async ({ page }) => {
  await mount(page, "word");
  await cursorAt(page, 2);
  await button(page, "Bold").click();
  expect(await doc(page)).toBe("**word**");
  await expect(page.locator(".cm-editor")).toHaveClass(/cm-focused/);
});

test("buttons show pressed from the syntax tree at the cursor", async ({ page }) => {
  await mount(page, "**bold** plain\n## Heading");
  await cursorAt(page, 3);
  await expect(button(page, "Bold")).toHaveAttribute("aria-pressed", "true");
  await expect(button(page, "Heading 2")).toHaveAttribute("aria-pressed", "false");
  await cursorAt(page, 18);
  await expect(button(page, "Bold")).toHaveAttribute("aria-pressed", "false");
  await expect(button(page, "Heading 2")).toHaveAttribute("aria-pressed", "true");
  // Pressed buttons draw with their tokens, carried on the toolbar itself.
  await expect(button(page, "Heading 2")).toHaveCSS("background-color", rgb(themes.light.buttonPressed));
  await expect(button(page, "Heading 2")).toHaveCSS("color", rgb(themes.light.buttonPressedForeground));
  // Inserting commands have no pressed state.
  await expect(button(page, "Table")).not.toHaveAttribute("aria-pressed");
});

test("tooltips show the label and the keys for this platform", async ({ page }) => {
  await mount(page, "");
  const title = await button(page, "Bold").getAttribute("title");
  expect(title).toMatch(/^Bold \((Ctrl\+B|⌘B)\)$/);
  await expect(button(page, "Table")).toHaveAttribute("title", "Table");
});

test("the toolbar is one Tab stop and arrow keys move along it", async ({ page }) => {
  await mount(page, "text");
  await page.keyboard.press("Tab");
  await expect(button(page, "Bold")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(button(page, "Italic")).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.locator(".nme-more > .nme-button")).toBeFocused();
  await page.keyboard.press("Home");
  await expect(button(page, "Bold")).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".nme-more > .nme-button")).toBeFocused();
  // Only the current button is in the Tab order.
  expect(await page.locator('.nme-toolbar [tabindex="0"]').count()).toBe(1);
});

test("Alt-F10 moves focus to the toolbar and Escape goes back", async ({ page }) => {
  await mount(page, "text");
  await page.locator(".cm-content").click();
  await page.keyboard.press("Alt+F10");
  await expect(button(page, "Bold")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator(".cm-editor")).toHaveClass(/cm-focused/);
});

test.describe("with every button on the bar", () => {
  // A desktop's width: on phones, the end of the bar is in More.
  test.use({ viewport: devices["Desktop Chrome"].viewport });

  test("the More menu is a real menu with arrow keys", async ({ page }) => {
    await mount(page, "text");
    const more = page.locator(".nme-more > .nme-button");
    await expect(more).toHaveAttribute("aria-haspopup", "menu");
    await more.focus();
    await page.keyboard.press("ArrowDown");
    await expect(more).toHaveAttribute("aria-expanded", "true");
    const items = page.locator(".nme-more .nme-menu-item");
    await expect(items.first()).toBeFocused();
    await expect(items.first()).toHaveText("Heading 4");
    await page.keyboard.press("ArrowDown");
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await expect(more).toBeFocused();
  });
});

test("running a menu item closes the menu and edits the doc", async ({ page }) => {
  await mount(page, "title");
  await cursorAt(page, 2);
  await page.locator(".nme-more > .nme-button").click();
  await page.locator(".nme-more .nme-menu-item", { hasText: "Heading 5" }).click();
  expect(await doc(page)).toBe("##### title");
  await expect(page.locator(".nme-more .nme-menu")).toBeHidden();
  await expect(page.locator(".cm-editor")).toHaveClass(/cm-focused/);
});

test("items that don't fit move into More from the right, never a second row", async ({ page }) => {
  await mount(page, "text", { width: "320px" });
  const toolbar = page.locator(".nme-toolbar");
  const box = await toolbar.boundingBox();
  const height = await page.locator(".nme-button").first().evaluate((el) => el.getBoundingClientRect().height);
  expect(box!.height).toBeLessThan(height * 2);
  expect(await toolbar.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await expect(button(page, "Bold")).toBeVisible();
  await expect(button(page, "Horizontal rule")).toBeHidden();
  await page.locator(".nme-more > .nme-button").click();
  const labels = await page.locator(".nme-more .nme-menu-item").allTextContents();
  expect(labels).toContain("Horizontal rule");
  expect(labels.at(-1)).toBe("Heading 6");
  // Wider again, the items come back.
  await page.evaluate(() => (document.getElementById("app")!.style.width = "1400px"));
  await expect(button(page, "Horizontal rule")).toBeVisible();
});

test.describe("with every button on the bar", () => {
  // A desktop's width: on phones, the end of the bar is in More.
  test.use({ viewport: devices["Desktop Chrome"].viewport });

  test("the table menu shows only in a table", async ({ page }) => {
    await mount(page, "text\n\n| a | b |\n| - | - |");
    const menu = page.locator('.nme-menu-anchor > .nme-button[aria-label="Table"]');
    await expect(menu).toBeHidden();
    await cursorAt(page, 9);
    await expect(menu).toBeVisible();
    await menu.click();
    await page.locator(".nme-menu-item", { hasText: "Add row below" }).click();
    expect(await doc(page)).toBe("text\n\n| a | b |\n| - | - |\n|  |  |");
  });
});

test("buttons are disabled while the editor is read-only", async ({ page }) => {
  await mount(page, "text", { readOnly: true });
  await expect(button(page, "Bold")).toBeDisabled();
  await expect(page.locator(".nme-more > .nme-button")).toBeDisabled();
});
