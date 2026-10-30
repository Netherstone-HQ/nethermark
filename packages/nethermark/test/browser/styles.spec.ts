import { expect, test, type Page } from "@playwright/test";
import { themes } from "../../src/theme/index.js";

/** A #rrggbb color as the browser reports a computed one. */
function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

async function mount(page: Page, doc: string, theme: "light" | "dark" = "light") {
  await page.goto("/");
  await page.evaluate(([d, t]) => window.mount(d!, { theme: t as "light" | "dark" }), [doc, theme]);
}

test("syntax takes its colors from the theme", async ({ page }) => {
  await mount(page, "**bold** *em* `code` [link](http://x)\n\n- item");
  // The text spans, not the markers around them.
  const strong = page.locator(".nme-strong:not(.nme-markup)");
  await expect(strong).toHaveCSS("color", rgb(themes.light.strong));
  await expect(strong).toHaveCSS("font-weight", "700");
  await expect(page.locator(".nme-strong.nme-markup").first()).toHaveCSS("color", rgb(themes.light.markup));
  await expect(page.locator(".nme-em:not(.nme-markup)")).toHaveCSS("font-style", "italic");
  await expect(page.locator(".nme-code", { hasText: "code" })).toHaveCSS("background-color", rgb(themes.light.codeBackground));
  await expect(page.locator(".nme-list-marker")).toHaveCSS("color", rgb(themes.light.listMarker));
  await expect(page.locator(".cm-editor")).toHaveCSS("background-color", rgb(themes.light.background));
});

test("the dark preset draws the same parts dark", async ({ page }) => {
  await mount(page, "# Title", "dark");
  await expect(page.locator(".cm-editor")).toHaveCSS("background-color", rgb(themes.dark.background));
  await expect(page.locator(".nme-heading:not(.nme-markup)")).toHaveCSS("color", rgb(themes.dark.heading));
  await expect(page.locator(".cm-editor")).toHaveCSS("color-scheme", "dark");
});

test("heading lines grow by headingScale per level", async ({ page }) => {
  await mount(page, "# one\n###### six");
  const base = Number.parseFloat(themes.light.fontSize);
  const scale = Number(themes.light.headingScale);
  const size = async (selector: string) => Number.parseFloat(await page.locator(selector).evaluate((el) => getComputedStyle(el).fontSize));
  expect(await size(".nme-line-h1")).toBeCloseTo(base * scale ** 5, 1);
  expect(await size(".nme-line-h6")).toBeCloseTo(base, 1);
});

test("a plain host rule beats the package's CSS without !important", async ({ page }) => {
  await mount(page, "**bold**");
  await page.addStyleTag({ content: ".nme-strong { color: rgb(1, 2, 3); }" });
  await expect(page.locator(".nme-strong:not(.nme-markup)")).toHaveCSS("color", "rgb(1, 2, 3)");
});

test("the focus ring comes from its token", async ({ page }) => {
  await mount(page, "text");
  await page.locator(".cm-content").focus();
  await expect(page.locator(".cm-editor")).toHaveCSS("outline-color", rgb(themes.light.focusRing));
  await expect(page.locator(".cm-editor")).toHaveCSS("outline-width", themes.light.focusRingWidth);
});

test("only the visible lines get line classes", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 300 });
  await mount(page, Array.from({ length: 2000 }, (_, i) => `# Heading ${i}`).join("\n"));
  const decorated = await page.locator(".nme-line-h1").count();
  expect(decorated).toBeGreaterThan(0);
  expect(decorated).toBeLessThan(500);
});
