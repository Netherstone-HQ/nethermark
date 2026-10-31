import type { Page } from "@playwright/test";

/**
 * The key CodeMirror's Mod means on the page: Meta on a Mac or on iOS, Control
 * elsewhere, detected the way @codemirror/view does. Playwright's ControlOrMeta
 * goes by the machine running the tests, and an emulated iPhone keeps that
 * machine's navigator.platform, so neither tells.
 */
export async function mod(page: Page): Promise<"Meta" | "Control"> {
  const apple = await page.evaluate(() => {
    const ios = /Apple Computer/.test(navigator.vendor) && (/Mobile\/\w+/.test(navigator.userAgent) || navigator.maxTouchPoints > 2);
    return ios || /Mac/.test(navigator.platform);
  });
  return apple ? "Meta" : "Control";
}
