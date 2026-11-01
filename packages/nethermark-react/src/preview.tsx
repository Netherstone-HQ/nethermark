import { createPreview, previewButton, type Preview as PreviewHandle, type PreviewLayout, type PreviewOptions } from "@netherstone/nethermark/preview";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import type { ToolbarItem } from "@netherstone/nethermark";
import { useEditorEffect, useIsomorphicLayoutEffect, useToolbarItems } from "./addons.js";

export {
  previewButton,
  togglePreview,
  type Preview as PreviewHandle,
  type PreviewLayout,
  type PreviewRender,
} from "@netherstone/nethermark/preview";

export type PreviewProps = PreviewOptions;

/** What the preview adds to the default toolbar. */
const toolbarItems: readonly ToolbarItem[] = [/* @__PURE__ */ previewButton()];

type Sanitize = Extract<PreviewOptions["sanitize"], (html: string) => unknown>;

/**
 * The preview add-on, inside a `<MarkdownEditor>`. Its toggle joins the
 * default toolbar; with a toolbar of your own, add `previewButton()` to it.
 * `render`, `sanitize` and the callbacks can change any time. `open` and `layout` change it in place,
 * and the toggle in the toolbar still works between changes. A change to
 * `delay`, `scrollSync`, `label`, or to which kind of `sanitize` it is (built
 * in, your own, or off), builds it again, shown or hidden as it was. The ref
 * is the preview's handle, or null before there's an editor.
 */
export const Preview = forwardRef<PreviewHandle | null, PreviewProps>(function Preview(props, ref) {
  const latest = useRef(props);
  const live = useRef<PreviewHandle | null>(null);
  /** Whether the last preview showed, for the next one. */
  const shown = useRef<boolean | undefined>(undefined);
  const [handle, setHandle] = useState<PreviewHandle | null>(null);
  const applied = useRef<{ open: boolean | undefined; layout: PreviewLayout | undefined }>({ open: props.open, layout: props.layout });

  useIsomorphicLayoutEffect(() => {
    latest.current = props;
  });

  useToolbarItems(toolbarItems);

  const { delay, scrollSync, label } = props;
  const sanitizer = props.sanitize === false ? "off" : props.sanitize ? "custom" : "built-in";
  useEditorEffect(
    (editor) => {
      const props = latest.current;
      const preview = createPreview(editor.view, {
        render: (markdown) => latest.current.render(markdown),
        sanitize: sanitizer === "off" ? false : sanitizer === "custom" ? (html) => (latest.current.sanitize as Sanitize)(html) : undefined,
        layout: props.layout,
        // A rebuild keeps the preview shown or hidden as it was.
        open: shown.current ?? props.open,
        delay,
        scrollSync,
        label,
        onRender: (dom) => latest.current.onRender?.(dom),
        onError: (error) => (latest.current.onError ?? console.error)(error),
      });
      applied.current = { open: props.open, layout: props.layout };
      live.current = preview;
      setHandle(preview);
      return () => {
        shown.current = preview.isOpen();
        preview.destroy();
        live.current = null;
        setHandle(null);
      };
    },
    [delay, scrollSync, label, sanitizer],
  );

  useIsomorphicLayoutEffect(() => {
    const preview = live.current;
    if (!preview) return;
    const now = applied.current;
    if (props.open !== undefined && props.open !== now.open) preview.setOpen(props.open);
    if (props.layout !== undefined && props.layout !== now.layout) preview.setLayout(props.layout);
    applied.current = { open: props.open, layout: props.layout };
  });

  useImperativeHandle<PreviewHandle | null, PreviewHandle | null>(ref, () => handle, [handle]);
  return null;
});
