/**
 * The preview's built-in sanitizer: an allowlist of the elements and
 * attributes Markdown renders to. Anything else is removed, so a doc can't
 * run script or load what it shouldn't in the host's page.
 *
 * The HTML is parsed in an inert `<template>`, cleaned as nodes, and the
 * nodes themselves go in the page: it's never serialized and parsed again,
 * which is where mutation XSS comes from.
 */

/** Elements that keep their content when they're removed would show code or markup, so they go whole. */
const DROP = new Set([
  "script", "style", "template", "iframe", "frame", "frameset", "object", "embed", "applet",
  "noscript", "noembed", "noframes", "title", "textarea", "select", "option", "svg", "math",
  "link", "meta", "base", "head",
]);

/** Elements Markdown renders to, with the attributes each may keep besides the global ones. */
const ELEMENTS: Readonly<Record<string, readonly string[]>> = {
  a: ["href", "name"],
  abbr: [], b: [], bdi: [], bdo: [], blockquote: ["cite"], br: [], caption: [], cite: [], code: [],
  col: ["span"], colgroup: ["span"], dd: [], del: ["cite", "datetime"], details: ["open"], dfn: [], div: [], dl: [], dt: [],
  em: [], figcaption: [], figure: [], footer: [], h1: [], h2: [], h3: [], h4: [], h5: [], h6: [], header: [], hr: [], i: [],
  img: ["src", "alt", "width", "height"],
  input: ["type", "checked", "disabled"],
  ins: ["cite", "datetime"], kbd: [], li: ["value"], mark: [], ol: ["start", "reversed", "type"], p: [], pre: [],
  q: ["cite"], rp: [], rt: [], ruby: [], s: [], samp: [], section: [], small: [], span: [], strong: [], sub: [],
  summary: [], sup: [], table: [], tbody: [], td: ["colspan", "rowspan", "align"], tfoot: [],
  th: ["colspan", "rowspan", "align", "scope"], thead: [], time: ["datetime"], tr: [], u: [], ul: [], var: [], wbr: [],
};

/** Attributes any allowed element may keep. `data-` and `aria-` ones are allowed too. */
const GLOBAL = new Set(["id", "class", "title", "lang", "dir", "role"]);

/** Attributes that hold a URL, and the schemes they may use. Relative URLs are always allowed. */
const URLS: Readonly<Record<string, ReadonlySet<string>>> = {
  href: new Set(["http", "https", "mailto", "tel"]),
  src: new Set(["http", "https"]),
  cite: new Set(["http", "https"]),
};

/** Pictures inlined as data URLs. SVG is left out: it can carry script. */
const DATA_IMAGE = /^data:image\/(?:png|gif|jpe?g|webp|avif|bmp);/i;

/** A URL's scheme, lowercased, or null for a relative URL. Browsers ignore control characters and spaces in it. */
function schemeOf(url: string): string | null {
  const stripped = [...url].filter((char) => char > " " && char !== "\u007f").join("");
  const match = /^([a-z][a-z\d+.-]*):/i.exec(stripped);
  return match ? match[1]!.toLowerCase() : null;
}

function allowedUrl(element: string, attribute: string, value: string): boolean {
  const scheme = schemeOf(value);
  if (scheme === null) return true;
  if (element === "img" && attribute === "src" && DATA_IMAGE.test(value.trim())) return true;
  return URLS[attribute]!.has(scheme);
}

function allowedAttribute(element: string, name: string): boolean {
  return GLOBAL.has(name) || name.startsWith("data-") || name.startsWith("aria-") || ELEMENTS[element]!.includes(name);
}

function cleanElement(el: Element): void {
  const name = el.localName;
  for (const { name: attribute, value } of [...el.attributes]) {
    const keep = allowedAttribute(name, attribute) && (!(attribute in URLS) || allowedUrl(name, attribute, value));
    if (!keep) el.removeAttribute(attribute);
  }
  // Task list boxes only: a preview has nothing to submit.
  if (name === "input") {
    if (el.getAttribute("type")?.toLowerCase() !== "checkbox") el.remove();
    else el.setAttribute("disabled", "");
  }
  // A link that leaves the page opens in a new tab, so following one doesn't lose the doc being written.
  if (name === "a" && schemeOf(el.getAttribute("href") ?? "") !== null) {
    el.setAttribute("target", "_blank");
    el.setAttribute("rel", "noopener noreferrer");
  }
}

function clean(parent: ParentNode): void {
  for (const node of [...parent.childNodes]) {
    if (node.nodeType === Node.TEXT_NODE) continue;
    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.parentNode?.removeChild(node);
      continue;
    }
    const el = node as Element;
    const name = el.localName;
    if (el.namespaceURI !== "http://www.w3.org/1999/xhtml" || DROP.has(name)) {
      el.remove();
      continue;
    }
    clean(el);
    if (name in ELEMENTS) cleanElement(el);
    // An unknown element keeps its cleaned content, in its place.
    else el.replaceWith(...el.childNodes);
  }
}

/** HTML parsed in an inert template, so nothing in it loads or runs before it's cleaned. */
export function parseHtml(html: string, doc: Document): DocumentFragment {
  const template = doc.createElement("template");
  template.innerHTML = html;
  return template.content;
}

/** The built-in sanitizer: the HTML's safe nodes, ready to go in the page. */
export function sanitizeHtml(html: string, doc: Document = document): DocumentFragment {
  const fragment = parseHtml(html, doc);
  clean(fragment);
  return fragment;
}
