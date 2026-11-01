import { expect, test, type Page } from "@playwright/test";
import { mod } from "./keys.js";

const field = (page: Page) => page.locator("nether-mark");
const content = (page: Page) => page.locator("nether-mark .cm-content");

test.beforeEach(async ({ page }) => {
  await page.goto("/element.html");
  await expect(content(page)).toBeVisible();
});

test("renders in the light DOM with a toolbar, and starts from the value attribute", async ({ page }) => {
  expect(await page.evaluate(() => window.field.shadowRoot)).toBeNull();
  await expect(field(page).locator(".nme-root > .nme-toolbar")).toBeVisible();
  await expect(content(page)).toHaveText("start");
  expect(await page.evaluate(() => window.formData())).toEqual({ body: "start" });
});

test("takes its name from its label, and a label click focuses the text", async ({ page }) => {
  await expect(content(page)).toHaveAttribute("aria-label", "Body");
  await page.getByText("Body", { exact: true }).click();
  await expect(content(page)).toBeFocused();
});

test("fires input per edit and change on leaving, and the form sends the value", async ({ page }) => {
  await content(page).click();
  await page.keyboard.press(`${await mod(page)}+End`);
  await page.keyboard.type("ed");
  expect(await page.evaluate(() => window.events)).toEqual(["input", "input"]);
  await page.locator("#after").focus();
  expect(await page.evaluate(() => window.events)).toEqual(["input", "input", "change"]);
  expect(await page.evaluate(() => window.formData())).toEqual({ body: "started" });
});

test("a value set in code while focused fires no change on leaving", async ({ page }) => {
  await content(page).click();
  await page.evaluate(() => (window.field.value = "from code"));
  await page.locator("#after").focus();
  expect(await page.evaluate(() => window.events)).toEqual([]);
});

test("properties set before the tag is defined still apply", async ({ page }) => {
  await page.evaluate(() => {
    const early = document.createElement("early-mark") as unknown as InstanceType<typeof window.NetherMarkElement>;
    early.value = "early";
    early.strings = { bold: "Gras" };
    early.preview = { render: (markdown) => `<p>${markdown}</p>` };
    document.body.append(early);
    customElements.define("early-mark", class extends window.NetherMarkElement {});
  });
  const early = page.locator("early-mark");
  await expect(early.locator(".cm-content")).toHaveText("early");
  await expect(early.getByRole("button", { name: "Gras" })).toHaveCount(1);
  await expect(early.locator(".nme-preview p")).toHaveText("early");
});

test("setting value fires nothing, and a reset goes back to the value attribute", async ({ page }) => {
  await page.evaluate(() => (window.field.value = "# Title"));
  await expect(content(page)).toHaveText("# Title");
  expect(await page.evaluate(() => window.events)).toEqual([]);
  // Once edited, the attribute no longer sets the value.
  await page.evaluate(() => window.field.setAttribute("value", "new default"));
  await expect(content(page)).toHaveText("# Title");
  await page.locator("#reset").click();
  await expect(content(page)).toHaveText("new default");
  expect(await page.evaluate(() => window.formData())).toEqual({ body: "new default" });
});

test("required, readonly and disabled act as on a textarea", async ({ page }) => {
  await page.evaluate(() => {
    window.field.required = true;
    window.field.value = "";
  });
  expect(await page.evaluate(() => window.field.checkValidity())).toBe(false);
  await page.evaluate(() => (window.field.value = "x"));
  expect(await page.evaluate(() => window.field.checkValidity())).toBe(true);

  await page.evaluate(() => (window.field.readOnly = true));
  await expect(content(page)).toHaveAttribute("aria-readonly", "true");
  expect(await page.evaluate(() => window.formData())).toEqual({ body: "x" });

  await page.evaluate(() => {
    window.field.readOnly = false;
    window.field.disabled = true;
  });
  await expect(content(page)).toHaveAttribute("aria-disabled", "true");
  await expect(content(page)).toHaveAttribute("contenteditable", "false");
  // A disabled field isn't sent.
  expect(await page.evaluate(() => window.formData())).toEqual({});
});

test("is destroyed when taken out, keeps its editor when moved, and rebuilds with its value", async ({ page }) => {
  await content(page).click();
  await page.keyboard.press(`${await mod(page)}+End`);
  await page.keyboard.type("!");
  // A move in one go keeps the same editor, undo history included.
  const same = await page.evaluate(async () => {
    const before = window.field.editor;
    document.body.append(window.field);
    await Promise.resolve();
    return window.field.editor === before;
  });
  expect(same).toBe(true);
  await content(page).click();
  await page.keyboard.press(`${await mod(page)}+z`);
  await expect(content(page)).toHaveText("start");
  await page.keyboard.type("?");

  const gone = await page.evaluate(async () => {
    window.field.remove();
    await new Promise((resolve) => setTimeout(resolve));
    return { editor: window.field.editor, children: window.field.childElementCount, value: window.field.value };
  });
  expect(gone).toEqual({ editor: null, children: 0, value: "start?" });
  await page.evaluate(() => document.body.append(window.field));
  await expect(content(page)).toHaveText("start?");
});

test("changes the toolbar and line numbers from attributes, in one rebuild", async ({ page }) => {
  await page.evaluate(() => {
    window.field.toolbar = false;
    window.field.lineNumbers = false;
  });
  await expect(field(page).locator(".nme-toolbar")).toHaveCount(0);
  await expect(field(page).locator(".cm-gutters")).toHaveCount(0);
  await expect(content(page)).toHaveText("start");
});

test("theme switches live, and strings, icons and shortcuts pass through", async ({ page }) => {
  const background = () => page.locator("nether-mark .nme-root").evaluate((el) => getComputedStyle(el).getPropertyValue("--nme-background"));
  const light = await background();
  await page.evaluate(() => (window.field.theme = "dark"));
  expect(await background()).not.toBe(light);

  await page.evaluate(() => (window.field.strings = { bold: "Gras" }));
  await expect(page.getByRole("button", { name: "Gras" })).toBeVisible();

  await page.evaluate(() => (window.field.icons = { bold: "Gr" }));
  await expect(page.getByRole("button", { name: "Gras" }).locator(".nme-icon-text")).toHaveText("Gr");

  await page.evaluate(() => (window.field.shortcuts = { bold: ["Mod-j"] }));
  await content(page).click();
  await page.keyboard.press(`${await mod(page)}+a`);
  await page.keyboard.press(`${await mod(page)}+j`);
  await expect(content(page)).toHaveText("**start**");
});

test("passes paste to the onPaste property", async ({ page }) => {
  await page.evaluate(() => (window.field.onPaste = ({ html }) => (html ? "**pasted**" : undefined)));
  await content(page).click();
  await page.keyboard.press(`${await mod(page)}+End`);
  // A script-made clipboard, as the editor's paste tests use: Firefox drops clipboardData given to the constructor.
  await content(page).evaluate((el) => {
    const data: Record<string, string> = { "text/html": "<b>pasted</b>", "text/plain": "pasted" };
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: { getData: (type: string) => data[type] ?? "", types: Object.keys(data) } });
    el.dispatchEvent(event);
  });
  await expect(content(page)).toHaveText("start**pasted**");
});

test("shows the preview add-on, with its button on the default toolbar", async ({ page }) => {
  await page.evaluate(() => {
    window.field.preview = {
      render: (markdown) => markdown.split("\n").map((line, i) => `<p data-line="${i}">${line}</p>`).join(""),
    };
  });
  const pane = field(page).locator(".nme-preview");
  await expect(pane.locator("p")).toHaveText(["start"]);
  // At phone width the button may have moved into More.
  const onBar = page.getByRole("button", { name: "Preview", exact: true });
  if (await onBar.isVisible()) await onBar.click();
  else {
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.locator(".nme-menu:not([hidden]) .nme-menu-item", { hasText: "Preview" }).click();
  }
  await expect(pane).toBeHidden();
  expect(await page.evaluate(() => window.field.previewHandle?.isOpen())).toBe(false);
  // A rebuild keeps it closed.
  await page.evaluate(() => (window.field.lineNumbers = false));
  await expect(field(page).locator(".cm-gutters")).toHaveCount(0);
  await expect(pane).toBeHidden();
  expect(await page.evaluate(() => window.field.previewHandle?.isOpen())).toBe(false);
});
