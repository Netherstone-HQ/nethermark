import { Compartment, StateEffect, type EditorState } from "@codemirror/state";
import { keymap, ViewPlugin, type EditorView, type ViewUpdate } from "@codemirror/view";
import { classFor, classNamesFacet, type ClassNames, type Part } from "../classes.js";
import { shortcutsFacet } from "../keymap.js";
import { labelsFacet } from "../labels.js";
import { themeFacet } from "../styles/index.js";
import { themes } from "../theme/index.js";
import { themeStyle, type Theme } from "../theme/theme.js";
import { icons } from "./icons.js";
import { commandOf, defaultToolbar, isMenu, labelOf, type ToolbarButton, type ToolbarItem, type ToolbarMenu } from "./items.js";
import { formatKeys, isMac } from "./keys.js";
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

/** A bar button's name, for assistive tech and as its tooltip. */
function setLabel(el: HTMLElement, label: string): void {
  el.setAttribute("aria-label", label);
  el.title = label;
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
    this.popup.className = toolbar.classOf("menu");
    this.popup.setAttribute("role", "menu");
    this.popup.id = `nme-menu-${++ids}`;
    this.popup.hidden = true;
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", this.popup.id);
    // A click with no detail came from the keyboard: only then does focus move into the menu.
    // A tap or a mouse click leaves focus, and the selection, in the editor.
    trigger.addEventListener("click", (event) => {
      const fromKeys = event.detail === 0;
      if (this.isOpen) this.close(fromKeys);
      else this.open(0, fromKeys);
    });
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        this.open(event.key === "ArrowUp" ? -1 : 0, true);
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
        el.className = this.toolbar.classOf("menu-item");
        el.tabIndex = -1;
        el.setAttribute("role", this.toolbar.commandOf(button).isActive ? "menuitemcheckbox" : "menuitem");
        fillIcon(el, button.icon);
        el.append(this.toolbar.labelOf(button));
        el.addEventListener("click", () => {
          this.close(false);
          this.toolbar.run(button);
        });
        this.popup.append(el);
        this.entries.push({ el, button });
      }
    }
  }

  open(at: number, focus: boolean): void {
    if (this.entries.length === 0) return;
    this.toolbar.closeMenus(this);
    this.popup.hidden = false;
    this.trigger.setAttribute("aria-expanded", "true");
    this.toolbar.watchOutside(true);
    this.place();
    if (focus) this.focusEntry(at < 0 ? this.enabled().length - 1 : 0);
  }

  /**
   * Keeps the open menu on screen: it lines up with whichever side of its
   * button has more room, and scrolls when it's taller than the space below,
   * which on a phone ends at the on-screen keyboard.
   */
  private place(): void {
    const popup = this.popup;
    const win = popup.ownerDocument.defaultView;
    if (!win) return;
    const visible = win.visualViewport;
    const left = visible?.offsetLeft ?? 0;
    const top = visible?.offsetTop ?? 0;
    const right = left + (visible?.width ?? win.innerWidth);
    const bottom = top + (visible?.height ?? win.innerHeight);
    const button = this.trigger.getBoundingClientRect();
    const rtl = win.getComputedStyle(popup).direction === "rtl";
    // By default the menu lines up with its button's end edge and grows toward the start.
    const roomToStart = rtl ? right - button.left : button.right - left;
    const roomToEnd = rtl ? button.right - left : right - button.left;
    if (roomToEnd > roomToStart) popup.dataset.align = "start";
    else delete popup.dataset.align;
    popup.style.setProperty("--nme-menu-max-height", `${Math.max(0, bottom - button.bottom)}px`);
  }

  /** Shows a menu again after the bar was measured, unless its button is gone into More or its items are. */
  reopen(): void {
    this.popup.hidden = false;
    if (this.entries.length === 0 || this.trigger.closest("[hidden]")) this.close(false);
    else this.place();
  }

  /** Closes the menu, and says whether it was open. */
  close(focusTrigger: boolean): boolean {
    if (!this.isOpen) return false;
    this.popup.hidden = true;
    this.trigger.setAttribute("aria-expanded", "false");
    this.toolbar.watchOutside(false);
    if (focusTrigger) this.trigger.focus();
    return true;
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
  /** The label shown while a finger or pen presses a bar button, where there's no hover. */
  private readonly tip: HTMLDivElement;
  private theme: Theme | null = null;
  private readonly outside = (event: Event) => {
    if (!this.dom.contains(event.target as Node)) this.closeMenus(null);
  };

  private readonly names: ClassNames;

  constructor(
    private readonly view: EditorView,
    items: readonly ToolbarItem[],
  ) {
    mountToolbarStyles(this.root);
    this.names = view.state.facet(classNamesFacet);
    // A name that means no command is a mistake to show now, not on the first click.
    const named = (list: readonly ToolbarItem[]): void => {
      for (const item of list) {
        if (item === "separator") continue;
        if (isMenu(item)) named(item.menu);
        else this.commandOf(item);
      }
    };
    named(items);
    this.dom = document.createElement("div");
    this.dom.className = this.classOf("toolbar");
    this.dom.setAttribute("role", "toolbar");
    this.dom.setAttribute("aria-label", view.state.facet(labelsFacet).toolbar);
    this.dom.addEventListener("keydown", (event) => this.onKey(event));
    // Keeps the editor's focus and selection, and a phone's keyboard up, while pressing any button.
    this.dom.addEventListener("mousedown", (event) => {
      if ((event.target as Element).closest("button")) event.preventDefault();
    });
    this.tip = document.createElement("div");
    this.tip.className = "nme-tooltip";
    // The buttons carry their own labels for assistive tech; this is only what a finger hides.
    this.tip.setAttribute("aria-hidden", "true");
    this.tip.hidden = true;
    this.dom.addEventListener("pointerdown", (event) => this.press(event));
    for (const end of ["pointerup", "pointercancel"] as const) this.dom.addEventListener(end, () => (this.tip.hidden = true));
    // A long press shows the label, not the browser's own menu for the button.
    this.dom.addEventListener("contextmenu", (event) => {
      if ((event.target as Element).closest("button")) event.preventDefault();
    });
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

    const moreButton = this.barButton(icons.more, view.state.facet(labelsFacet).more);
    this.moreAnchor = document.createElement("div");
    this.moreAnchor.className = this.classOf("more");
    this.more = new Menu(moreButton, this);
    this.moreAnchor.append(moreButton, this.more.popup);
    this.dom.append(this.moreAnchor, this.tip);

    this.resize = new ResizeObserver(() => this.layout());
    this.resize.observe(this.dom);
    this.sync(view.state);
  }

  private barButton(icon: string, label: string): HTMLButtonElement {
    const el = document.createElement("button");
    el.type = "button";
    el.className = this.classOf("button");
    el.tabIndex = -1;
    setLabel(el, label);
    fillIcon(el, icon);
    return el;
  }

  private slotFor(item: ToolbarItem): Slot {
    if (item === "separator") {
      const el = document.createElement("div");
      el.className = this.classOf("separator");
      el.setAttribute("role", "separator");
      el.setAttribute("aria-orientation", "vertical");
      return { kind: "separator", el };
    }
    if (isMenu(item)) {
      const trigger = this.barButton(item.icon, this.labelOf(item));
      const anchor = document.createElement("div");
      anchor.className = "nme-menu-anchor";
      const menu = new Menu(trigger, this);
      menu.render(item.menu);
      anchor.append(trigger, menu.popup);
      return { kind: "menu", el: anchor, item, menu };
    }
    const el = this.barButton(item.icon, this.labelOf(item));
    el.addEventListener("click", () => this.run(item));
    this.buttons.push({ el, button: item });
    return { kind: "button", el, item };
  }

  /**
   * Shows a bar button's tooltip text while a finger or pen is down on it,
   * above the button when there's room on screen, so the finger doesn't hide it.
   */
  private press(event: PointerEvent): void {
    if (event.pointerType === "mouse") return;
    const button = (event.target as Element).closest("button");
    if (!button || !this.dom.contains(button) || button.closest(".nme-menu") || !button.title) return;
    const tip = this.tip;
    tip.textContent = button.title;
    tip.hidden = false;
    const bar = this.dom.getBoundingClientRect();
    const at = button.getBoundingClientRect();
    const size = tip.getBoundingClientRect();
    const top = this.dom.ownerDocument.defaultView?.visualViewport?.offsetTop ?? 0;
    const above = at.top - size.height >= top;
    tip.dataset.side = above ? "above" : "below";
    const x = Math.min(Math.max(0, at.left + at.width / 2 - size.width / 2 - bar.left), Math.max(0, bar.width - size.width));
    tip.style.setProperty("--nme-tooltip-x", `${x}px`);
    tip.style.setProperty("--nme-tooltip-y", `${(above ? at.top : at.bottom) - bar.top}px`);
  }

  /** A part's class, with the host's classes for it. */
  classOf(part: Part): string {
    return classFor(this.names, part);
  }

  /** The label an item shows in this editor. */
  labelOf(item: ToolbarButton | ToolbarMenu): string {
    return labelOf(item, this.view.state.facet(labelsFacet));
  }

  /** Every label on the bar and in its menus, after the editor's labels changed. */
  private relabel(state: EditorState): void {
    const labels = state.facet(labelsFacet);
    this.dom.setAttribute("aria-label", labels.toolbar);
    setLabel(this.more.trigger, labels.more);
    for (const slot of this.slots) {
      if (slot.kind === "button") setLabel(slot.el, labelOf(slot.item, labels));
      else if (slot.kind === "menu") {
        setLabel(slot.menu.trigger, labelOf(slot.item, labels));
        slot.menu.render(slot.item.menu);
      }
    }
  }

  /** The command a button runs in this editor. */
  commandOf(button: ToolbarButton) {
    return commandOf(this.view.state, button);
  }

  /** Runs a button's command on the editor, then gives the editor focus back. */
  run(button: ToolbarButton): void {
    this.commandOf(button)({ state: this.view.state, dispatch: (tr) => this.view.dispatch(tr) });
    this.view.focus();
  }

  /** Every button on the bar or in a menu, for their state. */
  private allEntries(): Entry[] {
    const menus = this.slots.flatMap((slot) => (slot.kind === "menu" ? slot.menu.entries : []));
    return [...this.buttons, ...menus, ...this.more.entries];
  }

  /**
   * Pressed state, tooltips, read-only, menus shown by context, and the theme,
   * from the editor's state. `relayout` fits the bar again even when none of those moved it.
   */
  sync(state: EditorState, relayout = false): void {
    this.syncButtons(state);
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
    const labels = state.facet(labelsFacet);
    const readOnly = state.readOnly;
    for (const { el, button } of this.allEntries()) {
      const command = commandOf(state, button);
      const keys = button.shortcut ?? (typeof button.command === "string" ? shortcuts[button.command] : undefined) ?? [];
      const label = labelOf(button, labels);
      el.title = keys.length > 0 ? `${label} (${keys.map((key) => formatKeys(key, isMac, labels)).join(", ")})` : label;
      if (command.isActive) {
        const active = String(command.isActive(state));
        el.setAttribute(el.getAttribute("role") === "menuitemcheckbox" ? "aria-checked" : "aria-pressed", active);
      }
      // Every built-in command edits, so they wait while the editor is read-only.
      el.disabled = readOnly && !button.enabledWhenReadOnly;
    }
    // A menu opens while any of its items can run.
    for (const menu of this.menus()) menu.trigger.disabled = menu.entries.every((entry) => entry.el.disabled);
  }

  /**
   * Fits the bar: every item shows, then items move into the More menu from
   * the right until the bar fits its width. It never wraps or scrolls.
   */
  layout(): void {
    // An open menu or the tooltip would count toward the bar's width: they're
    // out of the way while it's measured, in the same frame, and back after.
    const open = this.menus().filter((menu) => menu.isOpen);
    for (const menu of open) menu.popup.hidden = true;
    this.tip.hidden = true;
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
    for (const menu of open) menu.reopen();
    this.syncButtons(this.view.state);
    this.updateTabStops();
  }

  /** The bar's menus, the More menu last. */
  private menus(): Menu[] {
    return [...this.slots.flatMap((slot) => (slot.kind === "menu" ? [slot.menu] : [])), this.more];
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

  /** Closes every open menu but one, and says whether any was open. */
  closeMenus(except: Menu | null): boolean {
    let closed = false;
    for (const menu of this.menus()) {
      if (menu !== except && menu.close(false)) closed = true;
    }
    return closed;
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
    // Labels change widths, so the bar is fitted again, which fills More with them too.
    const relabel = update.startState.facet(labelsFacet) !== update.state.facet(labelsFacet);
    if (relabel) this.relabel(update.state);
    const facets = update.startState.facet(shortcutsFacet) !== update.state.facet(shortcutsFacet)
      || update.startState.facet(themeFacet) !== update.state.facet(themeFacet);
    // Effects can change a command's pressed state without touching the doc.
    const effects = update.transactions.some((tr) => tr.effects.length > 0);
    if (relabel || update.docChanged || update.selectionSet || effects || facets || update.startState.readOnly !== update.state.readOnly) {
      this.sync(update.state, relabel);
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
 * pressed state current, and Alt-F10 moves focus to it. Escape goes back,
 * or closes a menu that's open.
 */
export function createToolbar(view: EditorView, items: readonly ToolbarItem[] = defaultToolbar): Toolbar {
  const toolbar = new ToolbarView(view, items);
  const compartment = new Compartment();
  const plugin = ViewPlugin.define(() => ({ update: (update) => toolbar.update(update) }));
  const focusKey = keymap.of([
    { key: "Alt-F10", run: () => (toolbar.focus(), true) },
    // A menu opened by a tap or click leaves focus in the editor, so Escape there closes it.
    { key: "Escape", run: () => toolbar.closeMenus(null) },
  ]);
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
