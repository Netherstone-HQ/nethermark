import type { MarkdownConfig } from "@lezer/markdown";

const EQUALS = 61;
const delimiter = { resolve: "Highlight", mark: "HighlightMark" };

/**
 * A host's own syntax for the tests: `==text==` as a Highlight node, parsed
 * the way @lezer/markdown parses strikethrough.
 */
export const highlightSyntax: MarkdownConfig = {
  defineNodes: [{ name: "Highlight" }, { name: "HighlightMark" }],
  parseInline: [
    {
      name: "Highlight",
      parse(cx, next, pos) {
        if (next !== EQUALS || cx.char(pos + 1) !== EQUALS || cx.char(pos + 2) === EQUALS) return -1;
        const before = cx.slice(pos - 1, pos);
        const after = cx.slice(pos + 2, pos + 3);
        const spaceBefore = /\s|^$/.test(before);
        const spaceAfter = /\s|^$/.test(after);
        return cx.addDelimiter(delimiter, pos, pos + 2, !spaceAfter, !spaceBefore);
      },
      after: "Emphasis",
    },
  ],
};
