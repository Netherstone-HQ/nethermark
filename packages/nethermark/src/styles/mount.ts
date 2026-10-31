const mounted = new WeakMap<Document | ShadowRoot, Set<string>>();

/** Adds a stylesheet to a document or shadow root, once per root. */
export function mountStyles(root: Document | ShadowRoot, css: string): void {
  const sheets = mounted.get(root) ?? new Set<string>();
  if (sheets.has(css)) return;
  const doc = "host" in root ? root.ownerDocument : root;
  const Sheet = doc.defaultView?.CSSStyleSheet ?? CSSStyleSheet;
  const sheet = new Sheet();
  sheet.replaceSync(css);
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  sheets.add(css);
  mounted.set(root, sheets);
}
