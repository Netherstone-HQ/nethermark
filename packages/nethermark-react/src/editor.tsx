import {
  createMarkdownEditor,
  defaultToolbar,
  type CreateMarkdownEditorOptions,
  type MarkdownEditor as EditorHandle,
  type Labels,
  type Shortcuts,
  type ThemeOption,
  themes,
} from "@netherstone/nethermark";
import { Compartment, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { forwardRef, useImperativeHandle, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Addons, AddonsContext, useIsomorphicLayoutEffect } from "./addons.js";

export type MarkdownEditorProps = Omit<CreateMarkdownEditorOptions, "parent" | "doc" | "onChange"> & {
  /** The doc, for a controlled editor. It's applied when it differs from what the editor holds, as one undo step. */
  readonly value?: string;
  /** The doc to start with, for an uncontrolled editor. */
  readonly defaultValue?: string;
  /** Called with the whole doc after each edit. Not called when a new `value` is applied. */
  readonly onChange?: (value: string) => void;
  /** On the element that holds the editor. */
  readonly className?: string;
  readonly style?: CSSProperties;
  /** Add-ons, such as `<Preview>` from `@netherstone/nethermark-react/preview`. */
  readonly children?: ReactNode;
};

/**
 * The options the editor is built with. A change to one builds it again,
 * keeping the doc, the selection and focus, but not undo history. Lists and
 * records match by their items, so one written inline each render isn't a
 * change, but extensions, commands and toolbar items made in render are new
 * each time: make those once, outside the component or with `useMemo`.
 */
const BUILD_OPTIONS = ["toolbar", "commands", "classNames", "extensions", "markdownExtensions", "placeholder", "lineNumbers", "lineWrapping"] as const;

type Build = { readonly [K in (typeof BUILD_OPTIONS)[number]]: MarkdownEditorProps[K] } & {
  /** What add-ons give the default toolbar. */
  readonly addonItems: unknown;
};

/** What the editor last had for each option that changes in place. */
type Applied = {
  theme: ThemeOption | undefined;
  readOnly: boolean | undefined;
  shortcuts: Shortcuts | undefined;
  labels: Labels | undefined;
  ariaLabel: string | undefined;
};

/** The editor behind one `<MarkdownEditor>`: builds it, keeps it up to date with the props, and builds it again when it has to. */
class Controller {
  editor: EditorHandle | null = null;
  private parent: HTMLElement | null = null;
  private props: MarkdownEditorProps;
  /** The doc while there's no editor, such as between Strict Mode's two mounts. */
  private doc: string;
  /** The value the editor was last known to hold: the last one applied or reported. */
  private value: string | undefined;
  private applied: Applied | null = null;
  private build: Build | null = null;
  /** Set while a new `value` goes in, so it isn't reported back as an edit. */
  private applying = false;
  private readonly ariaLabel = new Compartment();

  constructor(
    props: MarkdownEditorProps,
    readonly addons: Addons,
    private readonly publish: (editor: EditorHandle | null) => void,
  ) {
    this.props = props;
    this.doc = props.value ?? props.defaultValue ?? "";
    this.value = props.value;
    // Once the commit is done, so add-ons that come and go together, or with the editor, build it once at most.
    addons.onToolbarChange = () =>
      queueMicrotask(() => {
        if (this.editor && this.build && !same(this.build, this.buildOf(this.props))) this.rebuild();
      });
  }

  mount(parent: HTMLElement): void {
    this.parent = parent;
    this.create();
  }

  unmount(): void {
    this.destroy();
    this.parent = null;
    this.publish(null);
  }

  /** Brings the editor up to date with new props. Each check is cheap, so it runs every render. */
  update(props: MarkdownEditorProps): void {
    this.props = props;
    const { editor, applied } = this;
    if (!editor || !applied) return;
    if (!same(this.build, this.buildOf(props))) {
      this.rebuild();
      return;
    }
    this.applyValue(editor, props.value);
    if (!same(props.theme, applied.theme)) editor.setTheme(props.theme ?? themes.light);
    if (Boolean(props.readOnly) !== Boolean(applied.readOnly)) editor.setReadOnly(props.readOnly ?? false);
    if (!same(props.shortcuts, applied.shortcuts)) editor.setShortcuts(props.shortcuts ?? {});
    if (!same(props.labels, applied.labels)) editor.setLabels(props.labels ?? {});
    if (props.ariaLabel !== applied.ariaLabel) editor.view.dispatch({ effects: this.ariaLabel.reconfigure(ariaLabelOf(props.ariaLabel)) });
    this.applied = appliedOf(props);
  }

  private applyValue(editor: EditorHandle, value: string | undefined): void {
    if (value === undefined || value === this.value) return;
    this.value = value;
    if (value === editor.getValue()) return;
    this.applying = true;
    try {
      editor.setValue(value);
    } finally {
      this.applying = false;
    }
  }

  private buildOf(props: MarkdownEditorProps): Build {
    const build = Object.fromEntries(BUILD_OPTIONS.map((key) => [key, props[key]])) as Omit<Build, "addonItems">;
    return { ...build, addonItems: props.toolbar === undefined ? this.addons.toolbarItems() : null };
  }

  private create(): void {
    const { props, parent } = this;
    if (!parent) return;
    const build = this.buildOf(props);
    const addonItems = build.addonItems as ReturnType<Addons["toolbarItems"]> | null;
    const reported: Extension = EditorView.updateListener.of((update) => {
      // The doc is only copied out for a host that listens.
      const { onChange } = this.props;
      if (!update.docChanged || this.applying || !onChange) return;
      const next = update.state.sliceDoc();
      this.value = next;
      onChange(next);
    });
    const editor = createMarkdownEditor({
      ...props,
      parent,
      doc: this.doc,
      // aria-label goes in a compartment of ours, so it changes in place.
      ariaLabel: undefined,
      toolbar: props.toolbar ?? (addonItems?.length ? [...defaultToolbar, "separator", ...addonItems] : undefined),
      onChange: undefined,
      onPaste: (input) => this.props.onPaste?.(input),
      onDrop: (input) => this.props.onDrop?.(input),
      extensions: [...(props.extensions ?? []), this.ariaLabel.of(ariaLabelOf(props.ariaLabel)), reported],
    });
    this.editor = editor;
    this.build = build;
    this.applied = appliedOf(props);
    this.addons.attach(editor);
    this.publish(editor);
    // A value that came while there was no editor.
    this.applyValue(editor, props.value);
  }

  private destroy(): void {
    const { editor } = this;
    if (!editor) return;
    this.doc = editor.getValue();
    this.addons.detach();
    editor.destroy();
    this.editor = null;
    this.applied = null;
    this.build = null;
  }

  /** Builds the editor again with the current props, keeping the doc, the selection and focus. */
  private rebuild(): void {
    const old = this.editor;
    if (!old) return;
    const selection = old.view.state.selection;
    const focused = old.view.hasFocus;
    this.destroy();
    this.create();
    const editor = this.editor;
    if (!editor) return;
    if (editor.getValue() === this.doc) editor.view.dispatch({ selection });
    if (focused) editor.focus();
  }
}

/**
 * The nethermark editor with its toolbar. `value`, `theme`, `readOnly`,
 * `shortcuts`, `labels` and `ariaLabel` change in place, keeping undo history
 * and the cursor, and the callbacks can change any time. A change to any
 * other option builds the editor again, keeping the doc. The ref is the
 * editor's handle, or null before it's built.
 */
export const MarkdownEditor = forwardRef<EditorHandle | null, MarkdownEditorProps>(function MarkdownEditor(props, ref) {
  const parent = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<EditorHandle | null>(null);
  const [controller] = useState(() => new Controller(props, new Addons(), setEditor));

  useIsomorphicLayoutEffect(() => {
    controller.mount(parent.current!);
    return () => controller.unmount();
  }, [controller]);

  useIsomorphicLayoutEffect(() => controller.update(props));

  useImperativeHandle<EditorHandle | null, EditorHandle | null>(ref, () => editor, [editor]);

  return (
    <div ref={parent} className={props.className} style={props.style}>
      <AddonsContext.Provider value={controller.addons}>{props.children}</AddonsContext.Provider>
    </div>
  );
});

function ariaLabelOf(label: string | undefined): Extension {
  return label ? EditorView.contentAttributes.of({ "aria-label": label }) : [];
}

function appliedOf(props: MarkdownEditorProps): Applied {
  return { theme: props.theme, readOnly: props.readOnly, shortcuts: props.shortcuts, labels: props.labels, ariaLabel: props.ariaLabel };
}

/**
 * Whether two option values are the same: plain objects and lists by their
 * items, anything else, like functions, extensions and themes, by identity.
 */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, i) => same(item, b[i]));
  if (!isPlain(a) || !isPlain(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => key in b && same(a[key], b[key]));
}

function isPlain(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
