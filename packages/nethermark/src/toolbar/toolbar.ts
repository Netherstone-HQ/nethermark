import { Compartment, StateEffect, type EditorState } from "@codemirror/state";
import { keymap, ViewPlugin, type EditorView, type ViewUpdate } from "@codemirror/view";
import { shortcutsFacet } from "../keymap.js";
import { themeFacet } from "../styles/index.js";
import { themes } from "../theme/index.js";
import { themeStyle, type Theme } from "../theme/theme.js";
import { icons } from "./icons.js";
import { commandOf, defaultToolbar, isMenu, type ToolbarButton, type ToolbarItem, type ToolbarMenu } from "./items.js";
import { formatKeys } from "./keys.js";
import { mountToolbarStyles } from "./styles.js";

/** A toolbar for an editor: put `dom` anywhere in the page. */
export type Toolbar = {
  readonly dom: HTMLElement;
  /** Moves focus to the toolbar, on its current button. */
  focus(): void;
  /** Takes the toolbar out of the page and off the editor. */
  destroy(): void;
};

/** A button on the bar or in a menu, with the item it shows. */
type Entry = { readonly el: HTMLButtonElement; readonly button: ToolbarButton };

/** A place on the bar. */
type Slot =
  | { readonly kind: "button"; readonly el: HTMLButtonElement; readonly item: ToolbarButton }
  | { readonly kind: "menu"; readonly el: HTMLElement; readonly item: ToolbarMenu; readonly menu: Menu }
  | { readonly kind: "separator"; readonly el: HTMLElement };

let ids = 0;

/** Whether an icon is SVG markup, not text. */
const isSvg = (icon: string) => icon.trimStart().startsWith("<svg");

function fillIcon(el: HTMLElement, icon: string): void {
  if (isSvg(icon)) {
    // The package's own icons, or SVG a host passed: never text from the doc.
    el.innerHTML = icon;
  } else {
    const text = document.createElement("span");
    text.className = "nme-icon-text";
    text.setAttribute("aria-hidden", "true");
    text.textContent = icon;
    el.append(text);
  }
}

/** A popup menu that opens from a button: a real menu, with arrow keys. */
class Menu {
  readonly popup: HTMLDivElement;
  entries: Entry[] = [];

  constructor(
    readonly trigger: HTMLButtonElement,
    private readonly toolbar: ToolbarView,
  ) {
    this.popup = document.createElement("div");
    this.popup.className = "nme-menu";
    this.popup.setAttribute("role", "menu");
    this.popup.id = `nme-menu-${++ids}`;
    this.popup.hidden = true;
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", this.popup.id);
    trigger.addEventListener("click", () => (this.isOpen ? this.close(true) : this.open()));
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        this.open(event.key === "ArrowUp" ? -1 : 0);
      }
    });
    this.popup.addEventListener("keydown", (event) => this.onKey(event));
  }

  get isOpen(): boolean {
    return !this.popup.hidden;
  }

  /**
   * Fills the menu: a menu among the items shows its own items as a group.
   * Separators only ever sit between two groups.
   */
  render(items: readonly ToolbarItem[]): void {
    const groups: ToolbarButton[][] = [[]];
    for (const item of items) {
      if (item === "separator") groups.push([]);
      else if (isMenu(item)) groups.push(item.menu.filter((child): child is ToolbarButton => child !== "separator" && !isMenu(child)), []);
      else groups[groups.length - 1]!.push(item);
    }
    this.popup.replaceChildren();
    this.entries = [];
    for (const group of groups.filter((g) => g.length > 0)) {
      if (this.entries.length > 0) {
        const line = document.createElement("div");
        line.className = "nme-menu-separator";
        line.setAttribute("role", "separator");
        this.popup.append(line);
      }
      for (const button of group) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "nme-menu-item";
        el.tabIndex = -1;
        el.setAttribute("role", commandOf(button).isActive ? "menuitemcheckbox" : "menuitem");
        fillIcon(el, button.icon);
        el.append(button.label);
        el.addEventListener("click", () => {
          this.close(false);
          this.toolbar.run(button);
        });
        this.popup.append(el);
        this.entries.push({ el, button });
      }
    }
  }

  open(at = 0): void {
    if (this.entries.length === 0) return;
    this.toolbar.closeMenus(this);
    this.popup.hidden = false;
    this.trigger.setAttribute("aria-expanded", "true");
    this.toolbar.watchOutside(true);
    this.focusEntry(at < 0 ? this.enabled().length - 1 : 0);
  }

  close(focusTrigger: boolean): void {
    if (!this.isOpen) return;
    this.popup.hidden = true;
    this.trigger.setAttribute("aria-expanded", "false");
    this.toolbar.watchOutside(false);
    if (focusTrigger) this.trigger.focus();
  }

  private enabled(): HTMLButtonElement[] {
    return this.entries.map((entry) => entry.el).filter((el) => !el.disabled);
  }

  private focusEntry(index: number): void {
    const enabled = this.enabled();
    const count = enabled.length;
    if (count > 0) enabled[((index % count) + count) % count]!.focus();
  }

  private onKey(event: KeyboardEvent): void {
    const enabled = this.enabled();
    const at = enabled.indexOf(event.target as HTMLButtonElement);
    const moves: Record<string, number> = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: enabled.length - 1 };
    if (event.key in moves) {
      event.preventDefault();
      this.focusEntry(moves[event.key]!);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.close(true);
    } else if (event.key === "Tab") {
      this.close(false);
    }
  }
}

class ToolbarView {
  readonly dom: HTMLDivElement;
  private readonly slots: Slot[] = [];
  private readonly more: Menu;
  private readonly moreAnchor: HTMLElement;
  private readonly inMore: ToolbarItem[];
  private readonly buttons: Entry[] = [];
  private readonly resize: ResizeObserver;
  private current: HTMLButtonElement | null = null;
  private theme: Theme | null = null;
  private readonly outside = (event: Event) => {
    if (!this.dom.contains(event.target as Node)) this.closeMenus(null);
  };

  constructor(
    private readonly view: EditorView,
    items: readonly ToolbarItem[],
  ) {
    mountToolbarStyles(this.root);
    this.dom = document.createElement("div");
    this.dom.className = "nme-toolbar";
    this.dom.setAttribute("role", "toolbar");
    this.dom.setAttribute("aria-label", "Formatting");
    this.dom.addEventListener("keydown", (event) => this.onKey(event));
    this.dom.addEventListener("focusin", (event) => {
      const target = event.target as HTMLElement;
      if (this.controls().includes(target as HTMLButtonElement)) this.setCurrent(target as HTMLButtonElement);
    });

    this.inMore = items.filter((item) => item !== "separator" && item.inMore);
    for (const item of items) {
      if (item !== "separator" && item.inMore) continue;
      this.slots.push(this.slotFor(item));
    }
    for (const slot of this.slots) this.dom.append(slot.el);

    const moreButton = this.barButton(icons.more, "More");
    this.moreAnchor = document.createElement("div");
    this.moreAnchor.className = "nme-more";
    this.more = new Menu(moreButton, this);
    this.moreAnchor.append(moreButton, this.more.popup);
    this.dom.append(this.moreAnchor);

    this.resize = new ResizeObserver(() => this.layout());
    this.resize.observe(this.dom);
    this.sync(view.state);
  }

  private barButton(icon: string, label: string): HTMLButtonElement {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "nme-button";
    el.tabIndex = -1;
    el.setAttribute("aria-label", label);
    el.title = label;
    fillIcon(el, icon);
    return el;
  }

  private slotFor(item: ToolbarItem): Slot {
    if (item === "separator") {
      const el = document.createElement("div");
      el.className = "nme-separator";
      el.setAttribute("role", "separator");
      el.setAttribute("aria-orientation", "vertical");
      return { kind: "separator", el };
    }
    if (isMenu(item)) {
      const trigger = this.barButton(item.icon, item.label);
      const anchor = document.createElement("div");
      anchor.className = "nme-menu-anchor";
      const menu = new Menu(trigger, this);
      menu.render(item.menu);
      anchor.append(trigger, menu.popup);
      return { kind: "menu", el: anchor, item, menu };
    }
    const el = this.barButton(item.icon, item.label);
    // Keeps the editor's focus and selection while clicking.
    el.addEventListener("mousedown", (event) => event.preventDefault());
    el.addEventListener("click", () => this.run(item));
    this.buttons.push({ el, button: item });
    return { kind: "button", el, item };
  }

  /** Runs a button's command on the editor, then gives the editor focus back. */
  run(button: ToolbarButton): void {
    commandOf(button)({ state: this.view.state, dispatch: (tr) => this.view.dispatch(tr) });
    this.view.focus();
  }

  /** Every button on the bar or in a menu, for their state. */
  private allEntries(): Entry[] {
    const menus = this.slots.flatMap((slot) => (slot.kind === "menu" ? slot.menu.entries : []));
    return [...this.buttons, ...menus, ...this.more.entries];
  }

  /** Pressed state, tooltips, read-only, menus shown by context, and the theme, from the editor's state. */
  sync(state: EditorState): void {
    this.syncButtons(state);
    let relayout = false;
    for (const slot of this.slots) {
      if (slot.kind !== "menu" || !slot.item.visible) continue;
      const shown = slot.item.visible(state);
      if (shown === (slot.el.dataset.context !== "off")) continue;
      slot.el.dataset.context = shown ? "on" : "off";
      relayout = true;
    }
    const theme = state.facet(themeFacet) ?? themes.light;
    if (theme !== this.theme) {
      this.theme = theme;
      // Custom properties only: the one inline style the package sets.
      this.dom.style.cssText = themeStyle(theme);
      relayout = true;
    }
    if (relayout) this.layout();
    else this.updateTabStops();
  }

  /** Tooltips, pressed state and read-only, on every button on the bar and in menus. */
  private syncButtons(state: EditorState): void {
    const shortcuts = state.facet(shortcutsFacet);
    const readOnly = state.readOnly;
    for (const { el, button } of this.allEntries()) {
      const command = commandOf(button);
      const keys = button.shortcut ?? (typeof button.command === "string" ? shortcuts[button.command] : []);
      el.title = keys.length > 0 ? `${button.label} (${keys.map((key) => formatKeys(key)).join(", ")})` : button.label;
      if (command.isActive) {
        const active = String(command.isActive(state));
        el.setAttribute(el.getAttribute("role") === "menuitemcheckbox" ? "aria-checked" : "aria-pressed", active);
      }
      // Every built-in command edits, so all of them wait while the editor is read-only.
      el.disabled = readOnly;
    }
    for (const slot of this.slots) if (slot.kind === "menu") slot.menu.trigger.disabled = readOnly;
    this.more.trigger.disabled = readOnly;
  }

  /**
   * Fits the bar: every item shows, then items move into the More menu from
   * the right until the bar fits its width. It never wraps or scrolls.
   */
  layout(): void {
    for (const slot of this.slots) slot.el.hidden = slot.el.dataset.context === "off";
    this.moreAnchor.hidden = this.inMore.length === 0;
    const overflow: Slot[] = [];
    const fits = () => this.dom.scrollWidth <= this.dom.clientWidth;
    for (let i = this.slots.length - 1; i >= 0 && !fits(); i--) {
      const slot = this.slots[i]!;
      if (slot.el.hidden) continue;
      slot.el.hidden = true;
      overflow.unshift(slot);
      this.moreAnchor.hidden = false;
    }
    // No separator at either end of the bar, or two in a row.
    let previous: Slot | null = null;
    for (const slot of this.slots) {
      if (slot.el.hidden) continue;
      if (slot.kind === "separator" && (!previous || previous.kind === "separator")) slot.el.hidden = true;
      else previous = slot;
    }
    if (previous?.kind === "separator") previous.el.hidden = true;

    const items = overflow.map((slot): ToolbarItem => (slot.kind === "separator" ? "separator" : slot.item));
    this.more.render([...items, "separator", ...this.inMore]);
    this.syncButtons(this.view.state);
    this.updateTabStops();
  }

  /** The bar's buttons that can take focus, in order. */
  private controls(): HTMLButtonElement[] {
    const triggers = this.slots.map((slot) => (slot.kind === "button" ? slot.el : slot.kind === "menu" ? slot.menu.trigger : null));
    return [...triggers, this.more.trigger].filter(
      (el): el is HTMLButtonElement => el !== null && !el.disabled && !el.closest("[hidden]"),
    );
  }

  private setCurrent(el: HTMLButtonElement): void {
    this.current = el;
    this.updateTabStops();
  }

  /** One Tab stop: the current button, or the first one. */
  private updateTabStops(): void {
    const controls = this.controls();
    if (!this.current || !controls.includes(this.current)) this.current = controls[0] ?? null;
    for (const el of [...this.slots.map((slot) => (slot.kind === "menu" ? slot.menu.trigger : slot.el)), this.more.trigger]) {
      if (el instanceof HTMLButtonElement) el.tabIndex = el === this.current ? 0 : -1;
    }
  }

  focus(): void {
    this.updateTabStops();
    this.current?.focus();
  }

  private onKey(event: KeyboardEvent): void {
    const controls = this.controls();
    const at = controls.indexOf(event.target as HTMLButtonElement);
    if (at < 0) return;
    const moves: Record<string, number> = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: controls.length - 1 };
    if (event.key in moves) {
      event.preventDefault();
      const count = controls.length;
      controls[((moves[event.key]! % count) + count) % count]!.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      this.view.focus();
    }
  }

  closeMenus(except: Menu | null): void {
    for (const menu of [...this.slots.flatMap((slot) => (slot.kind === "menu" ? [slot.menu] : [])), this.more]) {
      if (menu !== except) menu.close(false);
    }
  }

  /** The document or shadow root the editor is in, which CodeMirror types loosely. */
  private get root(): Document | ShadowRoot {
    return this.view.root as Document | ShadowRoot;
  }

  /** Closes menus on a press outside the toolbar while one is open. */
  watchOutside(on: boolean): void {
    const root = this.root;
    if (on) root.addEventListener("pointerdown", this.outside, true);
    else root.removeEventListener("pointerdown", this.outside, true);
  }

  update(update: ViewUpdate): void {
    const facets = update.startState.facet(shortcutsFacet) !== update.state.facet(shortcutsFacet)
      || update.startState.facet(themeFacet) !== update.state.facet(themeFacet);
    if (update.docChanged || update.selectionSet || facets || update.startState.readOnly !== update.state.readOnly) {
      this.sync(update.state);
    }
  }

  destroy(): void {
    this.resize.disconnect();
    this.watchOutside(false);
    this.dom.remove();
  }
}

/**
 * Builds a toolbar for an editor, on its own: the editor keeps the toolbar's
 * pressed state current, and Alt-F10 moves focus to it. Escape goes back.
 */
export function createToolbar(view: EditorView, items: readonly ToolbarItem[] = defaultToolbar): Toolbar {
  const toolbar = new ToolbarView(view, items);
  const compartment = new Compartment();
  const plugin = ViewPlugin.define(() => ({ update: (update) => toolbar.update(update) }));
  const focusKey = keymap.of([{ key: "Alt-F10", run: () => (toolbar.focus(), true) }]);
  view.dispatch({ effects: StateEffect.appendConfig.of(compartment.of([plugin, focusKey])) });
  return {
    dom: toolbar.dom,
    focus: () => toolbar.focus(),
    destroy: () => {
      toolbar.destroy();
      view.dispatch({ effects: compartment.reconfigure([]) });
    },
  };
}
