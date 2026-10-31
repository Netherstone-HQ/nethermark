import { Facet } from "@codemirror/state";

/** The parts of the editor with a stable `nme-` class, named by that class without its prefix. */
export type Part =
  | "root" | "toolbar" | "button" | "separator" | "more" | "menu" | "menu-item" | "gutter" | "content"
  | "line-h1" | "line-h2" | "line-h3" | "line-h4" | "line-h5" | "line-h6"
  | "line-quote" | "line-list" | "line-task" | "line-fence" | "line-table"
  | "strong" | "em" | "strike" | "code" | "link" | "markup"
  | "heading" | "url" | "quote" | "comment" | "list-marker" | "task-marker" | "table-border";

/** Host classes to add to parts, for Tailwind or other utility CSS: `{ strong: "font-black" }`. */
export type ClassNames = Partial<Readonly<Record<Part, string>>>;

/** The host classes in this editor. */
export const classNamesFacet = Facet.define<ClassNames, ClassNames>({
  combine: (values) => Object.assign({}, ...values) as ClassNames,
});

/** A part's class, with the host's classes for it. */
export function classFor(names: ClassNames, part: Part): string {
  const host = names[part]?.trim();
  return host ? `nme-${part} ${host}` : `nme-${part}`;
}
