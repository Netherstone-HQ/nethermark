import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import type { SyntaxNode, Tree } from "@lezer/common";

/**
 * How long a command may wait, in milliseconds, for the parser to reach the
 * text it works on. Past that, it uses the tree as far as it got.
 */
const PARSE_BUDGET = 100;

/** The syntax tree, parsed at least up to `upto`. */
export function treeUpTo(state: EditorState, upto: number): Tree {
  return ensureSyntaxTree(state, upto, PARSE_BUDGET) ?? syntaxTree(state);
}

/** The syntax tree, parsed at least to the end of the selection's last line. */
export function treeForSelection(state: EditorState): Tree {
  const end = state.selection.ranges.reduce((max, range) => Math.max(max, range.to), 0);
  return treeUpTo(state, state.doc.lineAt(end).to);
}

/** The innermost node at `pos` and each of its parents, innermost first. */
export function* ancestors(tree: Tree, pos: number, side: -1 | 0 | 1 = 0): Generator<SyntaxNode> {
  for (let node: SyntaxNode | null = tree.resolveInner(pos, side); node; node = node.parent) yield node;
}

/** The innermost node named one of `names` around `pos`. */
export function ancestorNamed(tree: Tree, pos: number, names: ReadonlySet<string>, side: -1 | 0 | 1 = 0): SyntaxNode | null {
  for (const node of ancestors(tree, pos, side)) if (names.has(node.name)) return node;
  return null;
}

/** The direct children of a node. */
export function children(node: SyntaxNode): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) out.push(child);
  return out;
}

/** Code, where Markdown characters are just text. */
export const CODE = new Set(["FencedCode", "CodeBlock", "InlineCode", "HTMLBlock", "CommentBlock"]);

/** The longest run of backticks in some text, which a code fence must be longer than. */
export function longestBacktickRun(text: string): number {
  let longest = 0;
  let current = 0;
  for (const char of text) {
    current = char === "`" ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}
