import { expect, test, type Page } from "@playwright/test";

type Options = Parameters<Window["createWithPreview"]>[0];

async function create(page: Page, options: Options = {}) {
  await page.goto("/");
  await page.evaluate((o) => window.createWithPreview(o), options);
}

const preview = (page: Page) => page.locator(".nme-preview");
const toggle = (page: Page) => page.getByRole("button", { name: "Preview", exact: true });

test("renders the doc beside the editor, and again after an edit", async ({ page }) => {
  await create(page, { doc: "one\ntwo" });
  await expect(page.locator(".nme-panes")).toHaveAttribute("data-layout", "split");
  await expect(preview(page).locator("p")).toHaveText(["one", "two"]);
  await expect(preview(page)).toHaveAttribute("role", "region");
  const editor = await page.locator(".cm-editor").boundingBox();
  const pane = await preview(page).boundingBox();
  expect(pane!.x).toBeGreaterThanOrEqual(editor!.x + editor!.width - 1);
  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("!");
  await expect(preview(page).locator("p").last()).toHaveText("two!");
});

test("an async renderer works, and renders run one at a time with the latest doc", async ({ page }) => {
  await create(page, { doc: "a", async: true });
  await expect(preview(page).locator("p")).toHaveText(["a"]);
  await page.evaluate(() => {
    for (const text of ["b", "c", "d"]) window.editor!.setValue(text);
  });
  await expect(preview(page).locator("p")).toHaveText(["d"]);
  // Edits in a burst don't each get a render.
  expect(await page.evaluate(() => window.renders)).toBeLessThan(4);
});

test("sanitizes by default", async ({ page }) => {
  const html = [
    `<p data-line="0" onclick="alert(1)">text</p>`,
    `<script>window.ran = true</script>`,
    `<img src="x" onerror="window.ran = true" alt="pic">`,
    `<a href="javascript:window.ran = true">bad</a>`,
    `<a href=" jav&#x09;ascript:window.ran = true">tabbed</a>`,
    `<a href="https://example.com">out</a>`,
    `<a href="#here">anchor</a>`,
    `<input type="text"><input type="checkbox" checked>`,
    `<svg><script>window.ran = true</script></svg>`,
    `<custom-tag><b>kept</b></custom-tag>`,
    `<style>body { display: none }</style>`,
  ].join("");
  await create(page, { html });
  const pane = preview(page);
  await expect(pane.locator("a")).toHaveCount(4);
  expect(await page.evaluate(() => (window as { ran?: boolean }).ran)).toBeUndefined();
  await expect(pane.locator("p")).not.toHaveAttribute("onclick");
  await expect(pane.locator("p")).toHaveAttribute("data-line", "0");
  await expect(pane.locator("img")).not.toHaveAttribute("onerror");
  await expect(pane.locator("img")).toHaveAttribute("alt", "pic");
  await expect(pane.getByText("bad")).not.toHaveAttribute("href");
  await expect(pane.getByText("tabbed")).not.toHaveAttribute("href");
  await expect(pane.getByText("out")).toHaveAttribute("target", "_blank");
  await expect(pane.getByText("out")).toHaveAttribute("rel", "noopener noreferrer");
  await expect(pane.getByText("anchor")).toHaveAttribute("href", "#here");
  await expect(pane.getByText("anchor")).not.toHaveAttribute("target");
  await expect(pane.locator("input")).toHaveCount(1);
  await expect(pane.locator("input")).toHaveAttribute("disabled", "");
  await expect(pane.locator("svg, script, style, custom-tag")).toHaveCount(0);
  await expect(pane.locator("b")).toHaveText("kept");
});

test("sanitize: false shows the HTML as given", async ({ page }) => {
  await create(page, { html: `<p onclick="void 0">raw</p>`, sanitize: false });
  await expect(preview(page).locator("p")).toHaveAttribute("onclick", "void 0");
});

test("the toolbar toggle shows and hides the preview, pressed while it shows", async ({ page }) => {
  await create(page, { doc: "text", open: false });
  await expect(preview(page)).toBeHidden();
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  await toggle(page).click();
  await expect(preview(page)).toBeVisible();
  await expect(preview(page).locator("p")).toHaveText(["text"]);
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  await toggle(page).click();
  await expect(preview(page)).toBeHidden();
  expect(await page.evaluate(() => window.preview!.isOpen())).toBe(false);
});

test("in tabs the preview takes the editor's place, which can't be edited while out of sight", async ({ page }) => {
  await create(page, { doc: "text", layout: "tabs", open: false });
  await page.locator(".cm-content").click();
  await toggle(page).click();
  await expect(page.locator(".cm-editor")).toHaveCSS("visibility", "hidden");
  const editor = await page.locator(".cm-editor").boundingBox();
  expect(await preview(page).boundingBox()).toEqual(editor);
  await expect(preview(page)).toBeFocused();
  // Formatting waits; the toggle doesn't.
  await expect(page.getByRole("button", { name: "Bold", exact: true })).toBeDisabled();
  await expect(toggle(page)).toBeEnabled();
  await toggle(page).click();
  await expect(page.locator(".cm-editor")).toHaveCSS("visibility", "visible");
  await expect(page.getByRole("button", { name: "Bold", exact: true })).toBeEnabled();
  await page.keyboard.type("!");
  expect(await page.evaluate(() => window.editor!.getValue())).toContain("!");
});

test("a read-only editor stays read-only after the tabs preview closes, and its toggle still works", async ({ page }) => {
  await create(page, { doc: "text", layout: "tabs", open: false, readOnly: true });
  await expect(toggle(page)).toBeEnabled();
  await toggle(page).click();
  await toggle(page).click();
  expect(await page.evaluate(() => window.view!.state.readOnly)).toBe(true);
});

test("follows the editor's scroll through data-line, and the editor follows back", async ({ page }) => {
  const doc = Array.from({ length: 300 }, (_, i) => `line ${i}`).join("\n");
  await create(page, { doc });
  await page.addStyleTag({ content: ".cm-editor { height: 300px; }" });
  await expect(preview(page).locator("p")).toHaveCount(300);
  await page.evaluate(() => {
    const view = window.view!;
    view.dispatch({ effects: (view.constructor as typeof import("@codemirror/view").EditorView).scrollIntoView(view.state.doc.line(151).from, { y: "start" }) });
  });
  const near = async (line: number) =>
    page.evaluate((n) => {
      const pane = document.querySelector(".nme-preview")!;
      const el = pane.querySelector(`[data-line="${n}"]`)!;
      return Math.abs(el.getBoundingClientRect().top - pane.getBoundingClientRect().top) < el.getBoundingClientRect().height * 2;
    }, line);
  await expect.poll(() => near(150)).toBe(true);
  await preview(page).evaluate((pane) => {
    const el = pane.querySelector<HTMLElement>('[data-line="40"]')!;
    pane.scrollTop += el.getBoundingClientRect().top - pane.getBoundingClientRect().top;
  });
  // Line 40 (0-based) sits at the editor's top, give or take rounding.
  await expect
    .poll(() => page.evaluate(() => {
      const view = window.view!;
      const block = view.lineBlockAt(view.state.doc.line(41).from);
      const top = view.scrollDOM.getBoundingClientRect().top - view.documentTop;
      return Math.abs(block.top - top) < block.height;
    }))
    .toBe(true);
});

test("destroy puts the editor back where it was", async ({ page }) => {
  await create(page, { doc: "text" });
  await page.evaluate(() => window.preview!.destroy());
  await expect(page.locator(".nme-panes, .nme-preview")).toHaveCount(0);
  await expect(page.locator(".nme-root > .cm-editor")).toBeVisible();
  // The toggle has no preview to show.
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
});
