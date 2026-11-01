import { Compartment, EditorState, Prec, StateEffect, StateField, type StateCommand, type Text } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import { classFor, classNamesFacet } from "../classes.js";
import type { MarkdownCommand } from "../commands/command.js";
import { themeFacet } from "../styles/index.js";
import { themes } from "../theme/index.js";
import { themeStyle, type Theme } from "../theme/theme.js";
import { defaultIcons } from "../icons.js";
import { defineToolbarItem, withIcon, type ToolbarButton } from "../toolbar/items.js";
import { parseHtml, sanitizeHtml } from "./sanitize.js";
import { mountPreviewStyles } from "./styles.js";

/** Side by side with the editor, or in its place, switched with the toggle. */
export type PreviewLayout = "split" | "tabs";

/** Turns the doc into HTML. Any Markdown library works; the package has no parser of its own. */
export type PreviewRender = (markdown: string) => string | Promise<string>;

export type PreviewOptions = {
  /** Turns the doc into HTML, sync or async. */
  readonly render: PreviewRender;
  /**
   * What makes the HTML safe to show. Left out, the built-in allowlist
   * sanitizer runs. A function replaces it, such as DOMPurify's `sanitize`,
   * and returns HTML or nodes. `false` shows the HTML as the renderer gave it:
   * only for HTML from a source you trust.
   */
  readonly sanitize?: ((html: string) => string | Node) | false;
  /** `"split"` (the default) or `"tabs"`. */
  readonly layout?: PreviewLayout;
  /** Whether the preview shows at first. Defaults to true. */
  readonly open?: boolean;
  /**
   * Milliseconds to wait after an edit before rendering. Left out, it waits
   * as long as the last render took, so a fast renderer feels live and a slow
   * one isn't asked again while it's still busy.
   */
  readonly delay?: number;
  /** Keeps the editor and preview scrolled to the same place, through `data-line` attributes. Defaults to true. */
  readonly scrollSync?: boolean;
  /** The preview's accessible name. Defaults to "Preview". */
  readonly label?: string;
  /** Called with the preview's element after each render, to run a host's own work on it, like drawing diagrams. */
  readonly onRender?: (dom: HTMLElement) => void;
  /** Called when render or sanitize throws. The last good preview stays. Defaults to `console.error`. */
  readonly onError?: (error: unknown) => void;
};

/** A preview for an editor, and what a host changes it with. */
export type Preview = {
  /** The preview's element, which holds the rendered HTML. */
  readonly dom: HTMLElement;
  isOpen(): boolean;
  setOpen(open: boolean): void;
  toggle(): void;
  setLayout(layout: PreviewLayout): void;
  /** Renders now, even when the doc hasn't changed, like after the renderer's own settings changed. */
  refresh(): Promise<void>;
  /** Takes the preview out, and puts the editor back where it was. */
  destroy(): void;
};

type PreviewState = { readonly open: boolean; readonly layout: PreviewLayout };

const setPreview = StateEffect.define<Partial<PreviewState>>();

/** The preview's state lives in the editor's, so the toolbar shows it and commands change it. */
const previewField = StateField.define<PreviewState | null>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) if (value && effect.is(setPreview)) value = { ...value, ...effect.value };
    return value;
  },
});

/** In tabs, the editor is out of sight while the preview shows, so nothing edits it unseen. */
const readOnlyInTabs = Prec.highest(
  EditorState.readOnly.computeN([previewField], (state) => {
    const preview = state.field(previewField, false);
    return preview?.open && preview.layout === "tabs" ? [true] : [];
  }),
);

/**
 * Shows or hides the editor's preview. It works in a read-only editor and does
 * nothing without a preview. Give it keys with the editor's `commands` and
 * `shortcuts` options.
 */
export const togglePreview: MarkdownCommand = Object.assign(
  (({ state, dispatch }) => {
    const preview = state.field(previewField, false);
    if (!preview) return false;
    dispatch(state.update({ effects: setPreview.of({ open: !preview.open }) }));
    return true;
  }) satisfies StateCommand,
  { isActive: (state: EditorState) => state.field(previewField, false)?.open ?? false },
);

/**
 * The toolbar button that shows or hides the preview, pressed while it shows.
 * Without an `icon` of its own, it draws the editor's `preview` icon.
 */
export function previewButton(options: { readonly label?: string; readonly icon?: string } = {}): ToolbarButton {
  const button = defineToolbarItem({
    command: togglePreview,
    icon: options.icon ?? defaultIcons.preview,
    label: options.label ?? "Preview",
    enabledWhenReadOnly: true,
  });
  return options.icon ? button : withIcon("preview", button);
}

/** An element in the preview that says which doc line it came from. */
type Target = { readonly line: number; readonly el: HTMLElement };

class PreviewView {
  readonly panes: HTMLDivElement;
  readonly pane: HTMLDivElement;
  private readonly compartment = new Compartment();
  private theme: Theme | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** Renders run one after another, so an older result never lands over a newer one. */
  private chain: Promise<void> = Promise.resolve();
  private rendered: Text | null = null;
  /** How long the last render took, the wait before the next one when no delay was given. */
  private cost = 0;
  private targets: Target[] | null = null;
  /** The scroll position this code set on each side, so the scroll it causes isn't followed back. */
  private readonly expected = new WeakMap<Element, number>();
  private destroyed = false;

  constructor(
    private readonly view: EditorView,
    private readonly options: PreviewOptions,
  ) {
    if (typeof options.render !== "function") throw new TypeError("A preview needs a render function that turns Markdown into HTML.");
    if (view.state.field(previewField, false)) throw new RangeError("This editor already has a preview.");
    mountPreviewStyles(view.root as Document | ShadowRoot);
    const names = view.state.facet(classNamesFacet);
    this.panes = document.createElement("div");
    this.panes.className = classFor(names, "panes");
    this.pane = document.createElement("div");
    this.pane.className = classFor(names, "preview");
    this.pane.setAttribute("role", "region");
    this.pane.setAttribute("aria-label", options.label ?? "Preview");
    // A scrolling region the keyboard can reach and scroll.
    this.pane.tabIndex = 0;
    view.dom.replaceWith(this.panes);
    this.panes.append(view.dom, this.pane);

    view.scrollDOM.addEventListener("scroll", this.onEditorScroll);
    this.pane.addEventListener("scroll", this.onPreviewScroll);

    const initial: PreviewState = { open: options.open ?? true, layout: options.layout ?? "split" };
    view.dispatch({
      effects: StateEffect.appendConfig.of(
        this.compartment.of([
          previewField.init(() => initial),
          readOnlyInTabs,
          EditorView.updateListener.of((update) => this.update(update)),
        ]),
      ),
    });
    this.apply(initial, null);
    this.syncTheme();
  }

  get state(): PreviewState {
    return this.view.state.field(previewField, false) ?? { open: false, layout: "split" };
  }

  set(change: Partial<PreviewState>): void {
    this.view.dispatch({ effects: setPreview.of(change) });
  }

  private update(update: ViewUpdate): void {
    if (this.destroyed) return;
    const before = update.startState.field(previewField, false);
    const after = update.state.field(previewField, false);
    if (!after) return;
    // The constructor shows the first state itself.
    if (before && before !== after) this.apply(after, before);
    if (update.docChanged) this.schedule();
    if (update.startState.facet(themeFacet) !== update.state.facet(themeFacet)) this.syncTheme();
  }

  /** Shows the state on the page: which panes show, where focus goes, and a render when the preview opens. */
  private apply(now: PreviewState, before: PreviewState | null): void {
    this.panes.dataset.layout = now.layout;
    this.panes.toggleAttribute("data-open", now.open);
    this.pane.hidden = !now.open;
    const tabs = now.layout === "tabs";
    const wasTabs = before?.open && before.layout === "tabs";
    if (now.open && !before?.open) {
      void this.request(false).then(() => this.followEditor());
    }
    if (tabs && now.open && !wasTabs) {
      // The editor is out of sight: focus goes with what's shown.
      if (this.view.hasFocus) this.pane.focus({ preventScroll: true });
    } else if (wasTabs && !(tabs && now.open)) {
      this.followPreview();
      if (this.pane.contains(this.pane.ownerDocument.activeElement)) this.view.focus();
    }
  }

  /** The theme's tokens on the panes, so the preview draws with them like the toolbar. */
  private syncTheme(): void {
    const theme = this.view.state.facet(themeFacet) ?? themes.light;
    if (theme === this.theme) return;
    this.theme = theme;
    // Custom properties only: the one inline style the package sets.
    this.panes.style.cssText = themeStyle(theme);
  }

  private schedule(): void {
    if (!this.state.open) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.request(false), this.options.delay ?? this.cost);
  }

  /** Queues a render after the one running, if any. */
  request(force: boolean): Promise<void> {
    clearTimeout(this.timer);
    this.chain = this.chain.then(() => this.render(force));
    return this.chain;
  }

  private async render(force: boolean): Promise<void> {
    if (this.destroyed || !this.state.open) return;
    const doc = this.view.state.doc;
    if (!force && doc === this.rendered) return;
    const started = performance.now();
    try {
      const html = await this.options.render(doc.toString());
      this.cost = performance.now() - started;
      if (this.destroyed) return;
      this.show(html);
      this.rendered = doc;
    } catch (error) {
      (this.options.onError ?? console.error)(error);
    }
  }

  private show(html: string): void {
    const { sanitize } = this.options;
    const doc = this.pane.ownerDocument;
    let content: Node;
    if (sanitize === false) content = parseHtml(html, doc);
    else if (sanitize) {
      const clean = sanitize(html);
      content = typeof clean === "string" ? parseHtml(clean, doc) : clean;
    } else content = sanitizeHtml(html, doc);
    const top = this.pane.scrollTop;
    this.pane.replaceChildren(content);
    this.targets = null;
    if (this.options.scrollSync === false) this.scrollTo(this.pane, top);
    else this.followEditor();
    this.options.onRender?.(this.pane);
  }

  // ── Scroll sync ────────────────────────────────────────────────────────────

  private readonly onEditorScroll = () => {
    if (this.expectedScroll(this.view.scrollDOM)) return;
    if (this.state.open && this.state.layout === "split") this.followEditor();
  };

  private readonly onPreviewScroll = () => {
    if (this.expectedScroll(this.pane)) return;
    if (this.state.open && this.state.layout === "split") this.followPreview();
  };

  /** Whether a scroll is the one this code just set, which isn't followed back. */
  private expectedScroll(el: Element): boolean {
    const expected = this.expected.get(el);
    this.expected.delete(el);
    return expected === el.scrollTop;
  }

  private scrollTo(el: Element, top: number): void {
    el.scrollTop = top;
    this.expected.set(el, el.scrollTop);
  }

  private get syncing(): boolean {
    return this.options.scrollSync !== false && this.state.open && !this.destroyed;
  }

  /** The elements with a `data-line`, in page order. */
  private lineTargets(): Target[] {
    if (this.targets) return this.targets;
    const targets: Target[] = [];
    for (const el of this.pane.querySelectorAll<HTMLElement>("[data-line]")) {
      const line = Number(el.dataset.line);
      // Lines only go forward: an element that goes back, like a footnote, would break the search.
      if (Number.isInteger(line) && line >= 0 && line >= (targets[targets.length - 1]?.line ?? 0)) targets.push({ line, el });
    }
    return (this.targets = targets);
  }

  /** Where an element sits in the preview's scrolled content. */
  private offsetOf(el: HTMLElement): number {
    return el.getBoundingClientRect().top - this.pane.getBoundingClientRect().top + this.pane.scrollTop;
  }

  /** Where the editor's scrolled content starts, in its scroller. */
  private editorOffset(): number {
    const scroller = this.view.scrollDOM;
    return this.view.documentTop - scroller.getBoundingClientRect().top + scroller.scrollTop;
  }

  /** The doc line at the top of the editor, from 0, with how far into it as a fraction. */
  private editorLine(): number {
    const y = Math.max(0, this.view.scrollDOM.scrollTop - this.editorOffset());
    const block = this.view.lineBlockAtHeight(y);
    const line = this.view.state.doc.lineAt(block.from).number - 1;
    return line + (block.height > 0 ? Math.min(1, Math.max(0, (y - block.top) / block.height)) : 0);
  }

  /** Scrolls the preview to the editor's place, between the elements around its line. */
  followEditor(): void {
    if (!this.syncing) return;
    const targets = this.lineTargets();
    if (targets.length === 0) return;
    const line = this.editorLine();
    // The last target at or before the line.
    let low = 0;
    let high = targets.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (targets[mid]!.line <= line) low = mid + 1;
      else high = mid;
    }
    const before = targets[low - 1];
    const after = targets[low];
    const from = before ? { line: before.line, y: this.offsetOf(before.el) } : { line: 0, y: 0 };
    const to = after
      ? { line: after.line, y: this.offsetOf(after.el) }
      : { line: this.view.state.doc.lines, y: this.pane.scrollHeight };
    const span = to.line - from.line;
    this.scrollTo(this.pane, from.y + (span > 0 ? ((line - from.line) / span) * (to.y - from.y) : 0));
  }

  /** Scrolls the editor to the preview's place: the line between the elements around the preview's top. */
  followPreview(): void {
    if (!this.syncing) return;
    const targets = this.lineTargets();
    if (targets.length === 0) return;
    const y = this.pane.scrollTop;
    // The last target at or above the top, measuring only the ones the search looks at.
    let low = 0;
    let high = targets.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (this.offsetOf(targets[mid]!.el) <= y) low = mid + 1;
      else high = mid;
    }
    const before = targets[low - 1];
    const after = targets[low];
    const doc = this.view.state.doc;
    const from = before ? { line: before.line, y: this.offsetOf(before.el) } : { line: 0, y: 0 };
    const to = after ? { line: after.line, y: this.offsetOf(after.el) } : { line: doc.lines, y: this.pane.scrollHeight };
    const height = to.y - from.y;
    const line = from.line + (height > 0 ? ((y - from.y) / height) * (to.line - from.line) : 0);
    const number = Math.min(doc.lines, Math.floor(line) + 1);
    const block = this.view.lineBlockAt(doc.line(number).from);
    const fraction = Math.min(1, line - (number - 1));
    this.scrollTo(this.view.scrollDOM, this.editorOffset() + block.top + fraction * block.height);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    clearTimeout(this.timer);
    this.view.scrollDOM.removeEventListener("scroll", this.onEditorScroll);
    this.pane.removeEventListener("scroll", this.onPreviewScroll);
    this.view.dispatch({ effects: this.compartment.reconfigure([]) });
    this.panes.replaceWith(this.view.dom);
  }
}

/**
 * Adds a preview to an editor: `createMarkdownEditor`'s `view`, or your own
 * `EditorView`. The preview goes next to the editor, which moves into a grid
 * with it. It renders while it shows, and follows the editor's scroll.
 */
export function createPreview(view: EditorView, options: PreviewOptions): Preview {
  const preview = new PreviewView(view, options);
  return {
    dom: preview.pane,
    isOpen: () => preview.state.open,
    setOpen: (open) => preview.set({ open }),
    toggle: () => preview.set({ open: !preview.state.open }),
    setLayout: (layout) => preview.set({ layout }),
    refresh: () => preview.request(true),
    destroy: () => preview.destroy(),
  };
}
