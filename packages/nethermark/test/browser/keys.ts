import type { Page } from "@playwright/test";

/**
 * The key CodeMirror's Mod means on the page's platform: Meta on Apple
 * devices, iPhones and iPads included, Control elsewhere. Playwright's
 * ControlOrMeta goes by the machine running the tests, not the device emulated.
 */
export async function mod(page: Page): Promise<"Meta" | "Control"> {
  return (await page.evaluate(() => /Mac|iP(hone|[oa]d)/.test(navigator.platform))) ? "Meta" : "Control";
}
