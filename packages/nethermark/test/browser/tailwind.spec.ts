import { expect, test, type Page } from "@playwright/test";
import { themes } from "../../src/theme/index.js";

/** A #rrggbb color as the browser reports a computed one. */
function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

const { light } = themes;

/** The React 19 app on Tailwind 4, with or without the line that places the `nme` layer. */
async function open(page: Page, ordered = false) {
  await page.goto(`/tailwind.html${ordered ? "?ordered" : ""}`);
  await expect(page.locator(".nme-preview h1")).toHaveText("Title");
}

const px = (page: Page, selector: string, property: string) =>
  page.locator(selector).first().evaluate((el, p) => Number.parseFloat(getComputedStyle(el).getPropertyValue(p)), property);

test("Strict Mode leaves one editor, one toolbar and one preview", async ({ page }) => {
  await open(page);
  await expect(page.locator(".cm-editor")).toHaveCount(1);
  await expect(page.locator(".nme-toolbar")).toHaveCount(1);
  await expect(page.locator(".nme-preview")).toHaveCount(1);
});

test("Tailwind's preflight doesn't wipe the toolbar", async ({ page }) => {
  await open(page);
  await expect(page.locator(".nme-toolbar")).toHaveCSS("padding-top", light.gap);
  const button = page.getByRole("button", { name: "Preview", exact: true });
  await expect(button).toHaveCSS("padding-left", light.gap);
  await expect(button).toHaveCSS("border-top-left-radius", light.radius);
  // The preview is open, so its button shows pressed.
  await expect(button).toHaveCSS("background-color", rgb(light.buttonPressed));
  await expect(page.locator(".nme-panes > .nme-preview")).toHaveCSS("border-left-width", light.borderWidth);
});

test("Tailwind's preflight doesn't flatten the preview", async ({ page }) => {
  await open(page);
  const pane = page.locator(".nme-preview");
  expect(await px(page, ".nme-preview h1", "font-size")).toBeGreaterThan(await px(page, ".nme-preview p", "font-size"));
  await expect(pane.locator("h1")).toHaveCSS("font-weight", "700");
  await expect(pane.locator("strong")).toHaveCSS("font-weight", "700");
  await expect(pane.locator("ul")).toHaveCSS("list-style-type", "disc");
  expect(await px(page, ".nme-preview ul", "padding-inline-start")).toBeGreaterThan(0);
  // The paragraph after the list stands apart from it.
  expect(await px(page, ".nme-preview p:last-child", "margin-top")).toBeGreaterThan(0);
});

test("with nme placed below Tailwind's utilities, a utility className wins", async ({ page }) => {
  await open(page, true);
  const red = await page.evaluate(() => {
    const probe = document.body.appendChild(document.createElement("span"));
    probe.className = "text-red-600";
    return getComputedStyle(probe).color;
  });
  expect(red).not.toBe(rgb(light.strong));
  await expect(page.locator(".cm-editor .nme-strong:not(.nme-markup)")).toHaveCSS("color", red);
  // And preflight still doesn't win over the package.
  await expect(page.locator(".nme-toolbar")).toHaveCSS("padding-top", light.gap);
});
