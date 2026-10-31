import { expect, test, type Page } from "@playwright/test";
import { mod } from "./keys.js";

// Taps need a touch screen: these run on the phone projects.
test.skip(({ hasTouch }) => !hasTouch, "needs a touch screen");

async function mount(page: Page, doc: string, options: { tableFirst?: boolean } = {}) {
  await page.goto("/");
  await page.evaluate(([d, o]) => window.mount(d, { toolbar: true, ...(o as object) }), [doc, options] as const);
}

const doc = (page: Page) => page.evaluate(() => window.view!.state.doc.toString());
const selection = (page: Page) =>
  page.evaluate(() => {
    const { from, to } = window.view!.state.selection.main;
    return [from, to];
  });
const select = (page: Page, anchor: number, head: number) =>
  page.evaluate(([a, h]) => {
    window.view!.focus();
    window.view!.dispatch({ selection: { anchor: a!, head: h! } });
  }, [anchor, head]);
const button = (page: Page, label: string) => page.locator(`.nme-toolbar .nme-button[aria-label="${label}"]`);
const editorFocused = (page: Page) => expect(page.locator(".cm-editor")).toHaveClass(/cm-focused/);
/** Whether the editor's own content holds focus, which keeps a phone's keyboard up. */
const contentFocused = (page: Page) => page.evaluate(() => document.activeElement === window.view!.contentDOM);

test("tapping a button keeps the editor's focus and the selection", async ({ page }) => {
  await mount(page, "one word");
  await select(page, 4, 8);
  await button(page, "Bold").tap();
  expect(await doc(page)).toBe("one **word**");
  expect(await selection(page)).toEqual([6, 10]);
  await editorFocused(page);
  expect(await contentFocused(page)).toBe(true);
});

test("tapping a menu open leaves focus in the editor, and its item runs on the selection", async ({ page }) => {
  await mount(page, "| a | b |\n| - | - |");
  await select(page, 2, 3);
  const table = button(page, "Table").and(page.locator(".nme-menu-anchor > .nme-button"));
  const more = page.locator(".nme-more > .nme-button");
  // At phone width the table menu may have moved into More.
  if (await table.isVisible()) await table.tap();
  else await more.tap();
  expect(await contentFocused(page)).toBe(true);
  expect(await selection(page)).toEqual([2, 3]);
  await page.locator(".nme-menu:not([hidden]) .nme-menu-item", { hasText: "Add row below" }).tap();
  expect(await doc(page)).toBe("| a | b |\n| - | - |\n|  |  |");
  await expect(page.locator(".nme-menu:not([hidden])")).toHaveCount(0);
  await editorFocused(page);
});

test("pressing a button shows its label, lifting the finger hides it", async ({ page }) => {
  await mount(page, "text");
  const tip = page.locator(".nme-tooltip");
  await expect(tip).toBeHidden();
  const box = (await button(page, "Bold").boundingBox())!;
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const session = await page.context().newCDPSession(page).catch(() => null);
  test.skip(!session, "pressing and holding needs raw touch events, which only Chromium gives here");
  await session!.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
  await expect(tip).toBeVisible();
  await expect(tip).toHaveText(/^Bold/);
  const bar = (await page.locator(".nme-toolbar").boundingBox())!;
  const shown = (await tip.boundingBox())!;
  expect(shown.x).toBeGreaterThanOrEqual(bar.x);
  expect(shown.x + shown.width).toBeLessThanOrEqual(bar.x + bar.width + 1);
  await session!.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(tip).toBeHidden();
});

test("an open menu stays on screen and scrolls when it's taller than the room below", async ({ page }) => {
  await mount(page, "text");
  // Leave only a little room under the bar.
  await page.evaluate(() => {
    const app = document.getElementById("app")!;
    app.style.marginTop = `${window.innerHeight - app.querySelector(".nme-toolbar")!.getBoundingClientRect().height * 3}px`;
  });
  await page.locator(".nme-more > .nme-button").tap();
  const menu = page.locator(".nme-more .nme-menu");
  await expect(menu).toBeVisible();
  const { left, right, bottom, scrolls } = await menu.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return { left: rect.left, right: rect.right, bottom: rect.bottom, scrolls: el.scrollHeight > el.clientHeight };
  });
  const width = await page.evaluate(() => window.innerWidth);
  const height = await page.evaluate(() => window.innerHeight);
  expect(left).toBeGreaterThanOrEqual(0);
  expect(right).toBeLessThanOrEqual(width);
  expect(bottom).toBeLessThanOrEqual(height);
  expect(scrolls).toBe(true);
});

test("a menu near the start of the bar opens toward the room it has", async ({ page }) => {
  await mount(page, "| a | b |\n| - | - |", { tableFirst: true });
  await select(page, 2, 2);
  const table = page.locator(".nme-menu-anchor > .nme-button");
  await table.tap();
  const menu = page.locator(".nme-menu-anchor .nme-menu");
  await expect(menu).toBeVisible();
  const box = (await menu.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
});

test("Escape in the editor closes a menu a tap opened", async ({ page }) => {
  await mount(page, "text");
  await page.locator(".cm-content").tap();
  await page.locator(".nme-more > .nme-button").tap();
  await expect(page.locator(".nme-more .nme-menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".nme-more .nme-menu")).toBeHidden();
  await editorFocused(page);
});

test("shortcuts and Alt-F10 still work from a keyboard on a touch device", async ({ page }) => {
  await mount(page, "word");
  await page.locator(".cm-content").tap();
  await select(page, 0, 4);
  await page.keyboard.press(`${await mod(page)}+b`);
  expect(await doc(page)).toBe("**word**");
  await page.keyboard.press("Alt+F10");
  await expect(page.locator(".nme-toolbar [tabindex='0']")).toBeFocused();
  await page.keyboard.press("Escape");
  await editorFocused(page);
});
