import { devices, expect, test, type Page } from "@playwright/test";
import { themes } from "../../src/theme/index.js";
import { mod } from "./keys.js";

type Options = Parameters<Window["create"]>[0];

async function create(page: Page, options: Options = {}) {
  await page.goto("/");
  await page.evaluate((o) => window.create(o), options);
}

const value = (page: Page) => page.evaluate(() => window.editor!.getValue());

function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

test("builds the toolbar and editor in one root, with every part's class", async ({ page }) => {
  await create(page, { doc: "text", ariaLabel: "Notes", classNames: { root: "host-root", content: "host-content", strong: "host-strong" } });
  const root = page.locator(".nme-root");
  await expect(root).toHaveClass(/host-root/);
  await expect(root.locator("> .nme-toolbar")).toBeVisible();
  await expect(root.locator(".cm-gutters")).toHaveClass(/nme-gutter/);
  await expect(root.locator(".cm-content")).toHaveClass(/nme-content host-content/);
  await expect(root.locator(".cm-content")).toHaveAttribute("aria-label", "Notes");
  // The root carries the tokens.
  expect(await root.evaluate((el) => el.style.getPropertyValue("--nme-background").trim())).toBe(themes.light.background);
});

test("onChange fires once per change, and getValue and setValue round-trip", async ({ page }) => {
  await create(page, { doc: "ab" });
  await page.locator(".cm-content").click();
  await page.keyboard.press("End");
  await page.keyboard.type("cd");
  expect(await page.evaluate(() => window.changes)).toEqual(["abc", "abcd"]);
  await page.evaluate(() => window.editor!.setValue("new"));
  expect(await value(page)).toBe("new");
  // One undo step brings the old doc back.
  await page.locator(".cm-content").click();
  await page.keyboard.press(`${await mod(page)}+z`);
  expect(await value(page)).toBe("abcd");
});

test("CRLF docs come back with CRLF", async ({ page }) => {
  await create(page, { doc: "a\r\nb" });
  expect(await value(page)).toBe("a\r\nb");
  await page.evaluate(() => window.editor!.run("bold"));
  expect(await value(page)).toMatch(/\r\n/);
  await page.evaluate(() => window.editor!.setValue("x\ny"));
  expect(await value(page)).toBe("x\ny");
});

test("run runs commands by name, and a host's command works everywhere", async ({ page }) => {
  await create(page, { doc: "word", custom: true });
  await page.evaluate(() => window.view!.dispatch({ selection: { anchor: 0, head: 4 } }));
  expect(await page.evaluate(() => window.editor!.run("shout"))).toBe(true);
  expect(await value(page)).toBe("WORD");
  expect(await page.evaluate(() => window.editor!.run("bold"))).toBe(true);
  expect(await value(page)).toBe("**WORD**");
  await expect(page.locator('.nme-button[aria-label="Shout"]')).toHaveAttribute("title", /^Shout \((Ctrl\+U|⌘U)\)$/);
  expect(await page.evaluate(() => {
    try {
      window.editor!.run("missing");
      return "ran";
    } catch (error) {
      return (error as Error).message;
    }
  })).toMatch(/no command named "missing"/);
});

test("setTheme swaps the theme and keeps the cursor and history", async ({ page }) => {
  await create(page, { doc: "abc" });
  await page.locator(".cm-content").click();
  await page.keyboard.type("x");
  const head = await page.evaluate(() => window.view!.state.selection.main.head);
  await page.evaluate(() => window.editor!.setTheme(window.presets.dark));
  await expect(page.locator(".cm-editor")).toHaveCSS("background-color", rgb(themes.dark.background));
  await expect(page.locator(".nme-toolbar")).toHaveCSS("background-color", rgb(themes.dark.toolbarBackground));
  expect(await page.evaluate(() => window.view!.state.selection.main.head)).toBe(head);
  await page.locator(".cm-content").press(`${await mod(page)}+z`);
  expect(await value(page)).toBe("abc");
});

test('theme "auto" follows the system', async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await create(page, { theme: "auto" });
  await expect(page.locator(".cm-editor")).toHaveCSS("background-color", rgb(themes.light.background));
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator(".cm-editor")).toHaveCSS("background-color", rgb(themes.dark.background));
});

test("setReadOnly and setShortcuts change the editor in place", async ({ page }) => {
  await create(page, { doc: "word" });
  const bold = page.locator('.nme-toolbar > .nme-button[aria-label="Bold"]');
  await page.evaluate(() => window.editor!.setReadOnly(true));
  await expect(bold).toBeDisabled();
  await page.evaluate(() => window.editor!.setReadOnly(false));
  await expect(bold).toBeEnabled();
  await page.evaluate(() => window.editor!.setShortcuts({ bold: ["Mod-Shift-b"] }));
  await expect(bold).toHaveAttribute("title", /^Bold \((Ctrl\+Shift\+B|⇧⌘B)\)$/);
  await page.locator(".cm-content").click();
  await page.keyboard.press(`${await mod(page)}+Shift+b`);
  expect(await value(page)).toBe("**word**");
});

test("options: no toolbar, no line numbers, a placeholder", async ({ page }) => {
  await create(page, { toolbar: false, lineNumbers: false, placeholder: "Write here" });
  await expect(page.locator(".nme-toolbar")).toHaveCount(0);
  await expect(page.locator(".cm-gutters")).toHaveCount(0);
  await expect(page.locator(".cm-placeholder")).toHaveText("Write here");
});

test("Enter continues a list, Tab nests it, and outside lists Tab moves focus on", async ({ page }) => {
  await create(page, { doc: "- a", toolbar: false });
  await page.locator(".cm-content").click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  // On Android, CodeMirror finishes Enter after the browser's own edit lands, so wait for it.
  await expect.poll(() => value(page)).toBe("- a\n- ");
  await page.keyboard.type("b");
  await page.keyboard.press("Tab");
  expect(await value(page)).toBe("- a\n  - b");
  await page.evaluate(() => window.editor!.setValue("plain"));
  await page.locator(".cm-content").click();
  await page.keyboard.press("Tab");
  await expect(page.locator("#after")).toBeFocused();
  expect(await value(page)).toBe("plain");
});

/**
 * Pastes HTML and its plain text. Firefox drops the clipboardData of a paste
 * event made in script, so the event carries it as a plain object, which
 * the editor reads the same way in every engine.
 */
async function pasteHtml(page: Page) {
  await page.locator(".cm-content").evaluate((el) => {
    const data: Record<string, string> = { "text/html": "<b>pasted</b>", "text/plain": "pasted" };
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: { getData: (type: string) => data[type] ?? "", types: Object.keys(data) } });
    el.dispatchEvent(event);
  });
}

test("pasted HTML goes through onPaste", async ({ page }) => {
  await create(page, { doc: "x ", paste: "sync" });
  await page.evaluate(() => window.view!.dispatch({ selection: { anchor: 2 } }));
  await pasteHtml(page);
  expect(await value(page)).toBe("x **pasted**");
  expect(await page.evaluate(() => window.hookInput)).toEqual({ html: "<b>pasted</b>", text: "pasted", files: [] });
});

test("pasted files go through onPaste", async ({ page }) => {
  await create(page, { doc: "x ", paste: "sync" });
  await page.evaluate(() => window.view!.dispatch({ selection: { anchor: 2 } }));
  await page.locator(".cm-content").evaluate((el) => {
    const files = [new File(["x"], "picture.png", { type: "image/png" })];
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: { getData: () => "", types: ["Files"], files } });
    el.dispatchEvent(event);
  });
  expect(await value(page)).toBe("x **pasted**");
  expect(await page.evaluate(() => window.hookInput)).toEqual({ html: "", text: "", files: ["picture.png"] });
});

test("an async onPaste result lands where the cursor was, after edits meanwhile", async ({ page }) => {
  await create(page, { doc: "end", paste: "async" });
  await page.evaluate(() => window.view!.dispatch({ selection: { anchor: 3 } }));
  await pasteHtml(page);
  await page.evaluate(() => window.view!.dispatch({ changes: { from: 0, insert: "the " } }));
  await page.evaluate(() => window.settle!(" **later**"));
  await expect.poll(() => value(page)).toBe("the end **later**");
});

test("when onPaste returns nothing, the plain text pastes", async ({ page }) => {
  await create(page, { doc: "", paste: "none" });
  await page.locator(".cm-content").focus();
  await pasteHtml(page);
  expect(await value(page)).toBe("pasted");
});

test("dropped files go through onDrop with their position", async ({ page }) => {
  await create(page, { doc: "text", drop: "sync" });
  await page.locator(".cm-content").evaluate((el) => {
    const data = new DataTransfer();
    data.items.add(new File(["x"], "picture.png", { type: "image/png" }));
    const line = el.querySelector(".cm-line")!.getBoundingClientRect();
    el.dispatchEvent(new DragEvent("drop", { dataTransfer: data, clientX: line.right - 1, clientY: line.top + line.height / 2, bubbles: true, cancelable: true }));
  });
  expect(await value(page)).toBe("text![](picture.png)");
  expect(await page.evaluate(() => (window.hookInput as { position: number }).position)).toBe(4);
});

test("labels replace the toolbar's strings, and setLabels changes them later", async ({ page }) => {
  await create(page, { doc: "x", labels: { toolbar: "Mise en forme", bold: "Gras" } });
  const toolbar = page.locator(".nme-toolbar");
  const bold = toolbar.locator("> .nme-button").first();
  await expect(toolbar).toHaveAttribute("aria-label", "Mise en forme");
  await expect(bold).toHaveAttribute("aria-label", "Gras");
  await expect(bold).toHaveAttribute("title", /^Gras \(/);
  await page.evaluate(() => window.editor!.setLabels({ bold: "Fett" }));
  await expect(toolbar).toHaveAttribute("aria-label", "Formatting");
  await expect(bold).toHaveAttribute("aria-label", "Fett");
  await expect(bold).toHaveAttribute("title", /^Fett \(/);
});

test("icons replace the toolbar's icons, in menus too, and setIcons changes them later", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 600 });
  await create(page, { doc: "x", icons: { bold: "Gr", more: "Mo", heading4: "H4" } });
  const toolbar = page.locator(".nme-toolbar");
  const bold = toolbar.getByRole("button", { name: "Bold" });
  const more = toolbar.getByRole("button", { name: "More" });
  await expect(bold).toHaveText("Gr");
  await expect(bold.locator("svg")).toHaveCount(0);
  await expect(more).toHaveText("Mo");
  await more.click();
  await expect(page.getByRole("menuitemcheckbox", { name: "Heading 4" }).locator(".nme-icon-text")).toHaveText("H4");
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.editor!.setIcons({ italic: "It" }));
  // Left out, the others go back to their defaults.
  await expect(bold.locator("svg.nme-icon")).toHaveCount(1);
  await expect(more.locator("svg.nme-icon")).toHaveCount(1);
  await expect(toolbar.getByRole("button", { name: "Italic" })).toHaveText("It");
});

test("destroy takes it all out of the page", async ({ page }) => {
  await create(page, { doc: "x" });
  await page.evaluate(() => window.editor!.destroy());
  await expect(page.locator(".nme-root")).toHaveCount(0);
});

test.describe("with every button on the bar", () => {
  // A desktop's width: on phones, the end of the bar is in More.
  test.use({ viewport: devices["Desktop Chrome"].viewport });

  test("a host's own syntax gets a command, a toolbar button and a pressed state", async ({ page }) => {
    await create(page, { doc: "word", highlight: true });
    const button = page.locator('.nme-toolbar > .nme-button[aria-label="Highlight"]');
    await page.evaluate(() => window.view!.dispatch({ selection: { anchor: 2 } }));
    await button.click();
    expect(await value(page)).toBe("==word==");
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await button.click();
    expect(await value(page)).toBe("word");
    await expect(button).toHaveAttribute("aria-pressed", "false");
  });
});
