import { Compartment, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { ClassNames } from "../classes.js";
import type { MarkdownCommand } from "../commands/command.js";
import { createMarkdownEditor, type MarkdownEditor } from "../editor/create.js";
import type { ThemeOption } from "../editor/editor.js";
import type { DropHook, PasteHook } from "../editor/paste.js";
import type { Shortcuts } from "../keymap.js";
import type { Icons } from "../icons.js";
import type { Labels } from "../labels.js";
import { createPreview, previewButton, type Preview, type PreviewOptions } from "../preview/preview.js";
import { themes } from "../theme/index.js";
import { defaultToolbar, type ToolbarItem } from "../toolbar/items.js";
import type { MarkdownExtension } from "@lezer/markdown";

/** Lets the module load where there's no DOM, like a server render, without defining anything. */
const Base = (typeof HTMLElement === "undefined" ? class {} : HTMLElement) as typeof HTMLElement;

/** Attributes that change a live editor without rebuilding it. */
const LIVE = ["value", "theme", "readonly", "aria-label", "required"] as const;
/** Attributes that rebuild the editor, keeping its value. */
const REBUILD = ["placeholder", "line-numbers", "line-wrapping", "toolbar"] as const;

/** Attributes that default to on take `"false"` to turn them off. */
const on = (value: string | null) => value !== "false";

function themeFromAttribute(value: string | null): ThemeOption {
  if (value === "auto") return "auto";
  return value === "dark" ? themes.dark : themes.light;
}

/**
 * `<nether-mark>`: the editor as a form field. It renders in the light DOM,
 * so page CSS and the `nme` layer style it as they do the vanilla editor.
 *
 * Simple options are attributes and properties: `value` (the starting value,
 * as on an `<input>`), `name`, `placeholder`, `theme` (`light`, `dark` or
 * `auto`, or a `Theme` object as a property), `readonly`, `disabled`,
 * `required`, `aria-label`, and `line-numbers`, `line-wrapping` and `toolbar`,
 * which are on unless set to `"false"`. The rest are properties: `strings`
 * (the `labels` option, since `labels` is the field's `<label>`s), `icons`, `shortcuts`, `commands`, `classNames`, `toolbarItems`, `extensions`,
 * `markdownExtensions`, `onPaste`, `onDrop` and `preview`.
 *
 * It fires `input` after each edit and `change` when focus leaves after an
 * edit, as a `<textarea>` does, and its value goes in its form's data. The
 * editor is built when the element joins the page and destroyed when it
 * leaves; moving it keeps the editor and its undo history.
 */
export class NetherMarkElement extends Base {
  static readonly formAssociated = true;
  static readonly observedAttributes: readonly string[] = [...LIVE, ...REBUILD];

  /** The editor's handle while the element is on the page, for `run`, `view` and the rest. */
  get editor(): MarkdownEditor | null {
    return this.#editor;
  }
  /** The preview's handle while there is one, for `toggle`, `setLayout` and `refresh`. */
  get previewHandle(): Preview | null {
    return this.#preview;
  }

  readonly #internals: ElementInternals = this.attachInternals();
  #editor: MarkdownEditor | null = null;
  #preview: Preview | null = null;
  /** The value while there's no editor, and the one a rebuild starts from. */
  #value: string | null = null;
  /** Edited since the start or the last reset, so the `value` attribute no longer sets the value. */
  #dirty = false;
  /** The value when focus came in, to tell whether `change` fires when it leaves. */
  #focusValue: string | null = null;
  /** Set while the element itself changes the doc, which fires no `input`. */
  #quiet = false;
  #disabled = false;
  #rebuildQueued = false;
  /** The text area's name and disabled state, which change without a rebuild. */
  readonly #contentAttributes = new Compartment();

  #theme: ThemeOption | null = null;
  #labels: Labels | undefined;
  #icons: Icons | undefined;
  #shortcuts: Shortcuts | undefined;
  #commands: Readonly<Record<string, MarkdownCommand>> | undefined;
  #classNames: ClassNames | undefined;
  #toolbarItems: readonly ToolbarItem[] | undefined;
  #extensions: readonly Extension[] | undefined;
  #markdownExtensions: readonly MarkdownExtension[] | undefined;
  #previewOptions: PreviewOptions | null = null;
  /** Whether the preview showed when the editor was last taken down, so a rebuild keeps it. */
  #previewOpen: boolean | null = null;
  #onPaste: PasteHook | null = null;
  #onDrop: DropHook | null = null;
  #requiredMessage = "Fill in this field.";

  constructor() {
    super();
    this.addEventListener("focusin", this.#onFocusIn);
    this.addEventListener("focusout", this.#onFocusOut);
    this.addEventListener("click", this.#onClick);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  connectedCallback(): void {
    this.#upgradeProperties();
    if (!this.#editor) this.#build();
  }

  /**
   * A page can set properties on the element before the tag is defined. Those
   * land on the element itself and hide the class's accessors, so they're
   * taken off and set again through them.
   */
  #upgradeProperties(): void {
    for (const name of upgradedProperties()) {
      if (!Object.hasOwn(this, name)) continue;
      const value: unknown = (this as Record<string, unknown>)[name];
      delete (this as Record<string, unknown>)[name];
      (this as Record<string, unknown>)[name] = value;
    }
  }

  disconnectedCallback(): void {
    // A move takes the element out and puts it back in one go: the editor stays.
    queueMicrotask(() => {
      if (!this.isConnected) this.#teardown();
    });
  }

  attributeChangedCallback(name: string, before: string | null, after: string | null): void {
    if (before === after) return;
    if (name === "value") {
      if (!this.#dirty) this.#setDoc(after ?? "");
    } else if (name === "theme") {
      if (!this.#theme) this.#editor?.setTheme(themeFromAttribute(after));
    } else if (name === "readonly") this.#syncReadOnly();
    else if (name === "aria-label") this.#syncContentAttributes();
    else if (name === "required") this.#syncForm();
    else this.#queueRebuild();
  }

  /** Called for the `disabled` attribute and for a disabled `<fieldset>` around the field. */
  formDisabledCallback(disabled: boolean): void {
    this.#disabled = disabled;
    this.#syncReadOnly();
  }

  formResetCallback(): void {
    this.#dirty = false;
    this.#setDoc(this.defaultValue);
  }

  formStateRestoreCallback(state: string | File | FormData | null): void {
    if (typeof state !== "string") return;
    this.#dirty = true;
    this.#setDoc(state);
  }

  #build(): void {
    const theme = this.#theme ?? themeFromAttribute(this.getAttribute("theme"));
    const preview = this.#previewOptions;
    const items = this.#toolbarItems ?? (preview ? [...defaultToolbar, "separator" as const, previewButton()] : defaultToolbar);
    this.replaceChildren();
    const editor = createMarkdownEditor({
      parent: this,
      doc: this.#value ?? this.defaultValue,
      theme,
      readOnly: this.#readOnly,
      placeholder: this.placeholder || undefined,
      lineNumbers: on(this.getAttribute("line-numbers")),
      lineWrapping: on(this.getAttribute("line-wrapping")),
      toolbar: on(this.getAttribute("toolbar")) ? items : false,
      labels: this.#labels,
      icons: this.#icons,
      shortcuts: this.#shortcuts,
      commands: this.#commands,
      classNames: this.#classNames,
      markdownExtensions: this.#markdownExtensions,
      // Read at call time, so a host can change them without a rebuild.
      onPaste: (input) => this.onPaste?.(input),
      onDrop: (input) => this.onDrop?.(input),
      extensions: [
        this.#contentAttributes.of(this.#contentAttributesExtension()),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          this.#value = null;
          this.#syncForm();
          if (this.#quiet) return;
          this.#dirty = true;
          this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        }),
        ...(this.#extensions ?? []),
      ],
    });
    // Native input and change events from inside, like a typed character or
    // a checkbox in the preview, would read as the field's own.
    const root = this.lastElementChild!;
    root.addEventListener("input", stop);
    root.addEventListener("change", stop);
    this.#editor = editor;
    this.#preview = preview ? createPreview(editor.view, { ...preview, open: this.#previewOpen ?? preview.open }) : null;
    this.#syncForm();
  }

  #teardown(): void {
    if (!this.#editor) return;
    this.#value = this.#editor.getValue();
    if (this.#preview) this.#previewOpen = this.#preview.isOpen();
    this.#preview?.destroy();
    this.#preview = null;
    this.#editor.destroy();
    this.#editor = null;
  }

  /** Rebuilds once for any number of option changes made together. */
  #queueRebuild(): void {
    if (!this.#editor || this.#rebuildQueued) return;
    this.#rebuildQueued = true;
    queueMicrotask(() => {
      this.#rebuildQueued = false;
      if (!this.#editor || !this.isConnected) return;
      const focused = this.#editor.view.hasFocus;
      this.#teardown();
      this.#build();
      if (focused) this.#editor?.focus();
    });
  }

  // ── Syncing ────────────────────────────────────────────────────────────────

  get #readOnly(): boolean {
    return this.#disabled || this.hasAttribute("readonly");
  }

  #syncReadOnly(): void {
    this.#editor?.setReadOnly(this.#readOnly);
    this.#syncContentAttributes();
  }

  /** The text area's name, from the `aria-label` or else the field's `<label>`s, and whether it's disabled. */
  #contentAttributesExtension(): Extension {
    const own = this.getAttribute("aria-label");
    const name = own ?? [...this.#internals.labels].map((label) => textOutside(label, this)).filter(Boolean).join(" ");
    return [
      EditorView.contentAttributes.of({
        ...(name && { "aria-label": name }),
        ...(this.#disabled && { "aria-disabled": "true" }),
      }),
      // A disabled field can't be focused, as a disabled textarea can't.
      this.#disabled ? EditorView.editable.of(false) : [],
    ];
  }

  #syncContentAttributes(): void {
    this.#editor?.view.dispatch({ effects: this.#contentAttributes.reconfigure(this.#contentAttributesExtension()) });
  }

  #syncForm(): void {
    const value = this.value;
    this.#internals.setFormValue(value, value);
    if (this.hasAttribute("required") && value === "") {
      this.#internals.setValidity({ valueMissing: true }, this.requiredMessage, this.#editor?.view.contentDOM);
    } else this.#internals.setValidity({});
  }

  /** Sets the doc without firing `input`. */
  #setDoc(doc: string): void {
    if (this.#editor) {
      if (this.#editor.getValue() === doc) return;
      this.#quiet = true;
      try {
        this.#editor.setValue(doc);
      } finally {
        this.#quiet = false;
      }
    } else {
      this.#value = doc;
      this.#syncForm();
    }
    // As on a textarea, a value set in code while focused isn't an edit for `change`.
    if (this.#focusValue !== null) this.#focusValue = doc;
  }

  readonly #onFocusIn = () => {
    this.#focusValue ??= this.value;
  };

  readonly #onFocusOut = (event: FocusEvent) => {
    if (event.relatedTarget instanceof Node && this.contains(event.relatedTarget)) return;
    const before = this.#focusValue;
    this.#focusValue = null;
    if (before !== null && before !== this.value) this.dispatchEvent(new Event("change", { bubbles: true }));
  };

  /** A click on the element itself, like a `<label>`'s, goes to the text. */
  readonly #onClick = (event: MouseEvent) => {
    if (event.target === this) this.focus();
  };

  // ── The field ──────────────────────────────────────────────────────────────

  get value(): string {
    return this.#editor?.getValue() ?? this.#value ?? this.defaultValue;
  }
  set value(value: string) {
    this.#dirty = true;
    this.#setDoc(String(value));
  }

  /** The `value` attribute: the value at the start and after a form reset. */
  get defaultValue(): string {
    return this.getAttribute("value") ?? "";
  }
  set defaultValue(value: string) {
    this.setAttribute("value", value);
  }

  override focus(options?: FocusOptions): void {
    if (this.#editor) this.#editor.view.contentDOM.focus(options);
    else super.focus(options);
  }

  get form(): HTMLFormElement | null {
    return this.#internals.form;
  }
  get labels(): NodeList {
    return this.#internals.labels;
  }
  get validity(): ValidityState {
    return this.#internals.validity;
  }
  get validationMessage(): string {
    return this.#internals.validationMessage;
  }
  get willValidate(): boolean {
    return this.#internals.willValidate;
  }
  checkValidity(): boolean {
    return this.#internals.checkValidity();
  }
  reportValidity(): boolean {
    return this.#internals.reportValidity();
  }
  get type(): string {
    return this.localName;
  }

  // ── Attribute properties ───────────────────────────────────────────────────

  get name(): string {
    return this.getAttribute("name") ?? "";
  }
  set name(value: string) {
    this.setAttribute("name", value);
  }
  get placeholder(): string {
    return this.getAttribute("placeholder") ?? "";
  }
  set placeholder(value: string) {
    this.setAttribute("placeholder", value);
  }
  get readOnly(): boolean {
    return this.hasAttribute("readonly");
  }
  set readOnly(value: boolean) {
    this.toggleAttribute("readonly", Boolean(value));
  }
  get disabled(): boolean {
    return this.hasAttribute("disabled");
  }
  set disabled(value: boolean) {
    this.toggleAttribute("disabled", Boolean(value));
  }
  get required(): boolean {
    return this.hasAttribute("required");
  }
  set required(value: boolean) {
    this.toggleAttribute("required", Boolean(value));
  }
  get lineNumbers(): boolean {
    return on(this.getAttribute("line-numbers"));
  }
  set lineNumbers(value: boolean) {
    this.setAttribute("line-numbers", String(Boolean(value)));
  }
  get lineWrapping(): boolean {
    return on(this.getAttribute("line-wrapping"));
  }
  set lineWrapping(value: boolean) {
    this.setAttribute("line-wrapping", String(Boolean(value)));
  }
  /** Whether the toolbar shows. Its items are `toolbarItems`. */
  get toolbar(): boolean {
    return on(this.getAttribute("toolbar"));
  }
  set toolbar(value: boolean) {
    this.setAttribute("toolbar", String(Boolean(value)));
  }

  /** A `ThemeOption`. A string goes to the `theme` attribute; a `Theme` object or pair stays a property. */
  get theme(): ThemeOption {
    return this.#theme ?? themeFromAttribute(this.getAttribute("theme"));
  }
  set theme(value: ThemeOption | "light" | "dark") {
    if (typeof value === "string") {
      this.#theme = null;
      if (this.getAttribute("theme") === value) this.#editor?.setTheme(themeFromAttribute(value));
      else this.setAttribute("theme", value);
    } else {
      this.#theme = value;
      this.#editor?.setTheme(value);
    }
  }

  // ── Property-only options ──────────────────────────────────────────────────

  /** Strings to replace, as the `labels` option. Changes apply live. */
  get strings(): Labels | undefined {
    return this.#labels;
  }
  set strings(value: Labels | undefined) {
    this.#labels = value;
    this.#editor?.setLabels(value ?? {});
  }
  /** Icons to replace, as the `icons` option. Changes apply live. */
  get icons(): Icons | undefined {
    return this.#icons;
  }
  set icons(value: Icons | undefined) {
    this.#icons = value;
    this.#editor?.setIcons(value ?? {});
  }
  /** Keys, as the `shortcuts` option. Changes apply live. */
  get shortcuts(): Shortcuts | undefined {
    return this.#shortcuts;
  }
  set shortcuts(value: Shortcuts | undefined) {
    this.#shortcuts = value;
    this.#editor?.setShortcuts(value ?? {});
  }
  /** The host's own commands, as the `commands` option. Changing them rebuilds the editor. */
  get commands(): Readonly<Record<string, MarkdownCommand>> | undefined {
    return this.#commands;
  }
  set commands(value: Readonly<Record<string, MarkdownCommand>> | undefined) {
    this.#commands = value;
    this.#queueRebuild();
  }
  /** Host classes on parts, as the `classNames` option. Changing them rebuilds the editor. */
  get classNames(): ClassNames | undefined {
    return this.#classNames;
  }
  set classNames(value: ClassNames | undefined) {
    this.#classNames = value;
    this.#queueRebuild();
  }
  /**
   * The toolbar's items. Left out, the default toolbar, with the preview's
   * button at the end when there's a preview. Changing them rebuilds the editor.
   */
  get toolbarItems(): readonly ToolbarItem[] | undefined {
    return this.#toolbarItems;
  }
  set toolbarItems(value: readonly ToolbarItem[] | undefined) {
    this.#toolbarItems = value;
    this.#queueRebuild();
  }
  /** More CodeMirror extensions, as the `extensions` option. Changing them rebuilds the editor. */
  get extensions(): readonly Extension[] | undefined {
    return this.#extensions;
  }
  set extensions(value: readonly Extension[] | undefined) {
    this.#extensions = value;
    this.#queueRebuild();
  }
  /** Lezer Markdown extensions, as the `markdownExtensions` option. Changing them rebuilds the editor. */
  get markdownExtensions(): readonly MarkdownExtension[] | undefined {
    return this.#markdownExtensions;
  }
  set markdownExtensions(value: readonly MarkdownExtension[] | undefined) {
    this.#markdownExtensions = value;
    this.#queueRebuild();
  }
  /** The preview add-on's options, or null for none. Changing them rebuilds the editor. */
  get preview(): PreviewOptions | null {
    return this.#previewOptions;
  }
  set preview(value: PreviewOptions | null) {
    this.#previewOptions = value ?? null;
    if (!value) this.#previewOpen = null;
    this.#queueRebuild();
  }

  /** Called on paste, read at paste time, so it changes without a rebuild. */
  get onPaste(): PasteHook | null {
    return this.#onPaste;
  }
  set onPaste(value: PasteHook | null) {
    this.#onPaste = value ?? null;
  }
  /** Called on drop, read at drop time, so it changes without a rebuild. */
  get onDrop(): DropHook | null {
    return this.#onDrop;
  }
  set onDrop(value: DropHook | null) {
    this.#onDrop = value ?? null;
  }
  /** The message a browser shows when `required` and empty. */
  get requiredMessage(): string {
    return this.#requiredMessage;
  }
  set requiredMessage(value: string) {
    this.#requiredMessage = String(value);
    this.#syncForm();
  }
}

let upgraded: readonly string[] | null = null;

/**
 * Every property with a setter, so a new option needs no list kept by hand.
 * `value` goes last, after `defaultValue`, so it wins as it would have.
 */
function upgradedProperties(): readonly string[] {
  if (upgraded) return upgraded;
  const names = Object.entries(Object.getOwnPropertyDescriptors(NetherMarkElement.prototype))
    .filter(([, descriptor]) => descriptor.set !== undefined)
    .map(([name]) => name);
  return (upgraded = [...names.filter((name) => name !== "value"), "value"]);
}

/** A label's text, leaving out the field when the label wraps it. */
function textOutside(label: Node, field: Node): string {
  const walker = label.ownerDocument!.createTreeWalker(label, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node === field ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  let text = "";
  for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node.nodeType === Node.TEXT_NODE) text += node.nodeValue;
  return text.replace(/\s+/g, " ").trim();
}

function stop(event: Event): void {
  event.stopPropagation();
}
