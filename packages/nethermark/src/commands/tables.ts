import { EditorSelection, type ChangeSpec, type EditorState, type TransactionSpec } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import { defineCommand, type MarkdownCommand } from "./command.js";
import { ancestorNamed, children, treeUpTo } from "./tree.js";

type Align = "none" | "left" | "center" | "right";
type Cell = { readonly from: number; readonly to: number };
type Row = {
  /** Where the row's text starts and ends, after any quote markers. */
  readonly from: number;
  readonly to: number;
  readonly cells: readonly Cell[];
  readonly delimiter: boolean;
};
type Table = { readonly rows: readonly Row[]; readonly aligns: readonly Align[] };

/** The fewest dashes a delimiter cell has. */
const MIN_WIDTH = 3;

const TABLES = new Set(["Table"]);

/** The cells between a row's pipes, leaving out the empty edges outside a leading or trailing pipe. */
function cellsBetween(from: number, to: number, pipes: readonly number[]): Cell[] {
  const cells: Cell[] = [];
  let start = from;
  for (const pipe of pipes) {
    if (!(pipe === from && cells.length === 0 && start === from)) cells.push({ from: start, to: pipe });
    start = pipe + 1;
  }
  if (start < to || pipes.length === 0) cells.push({ from: start, to });
  return cells;
}

function alignOf(text: string): Align {
  const cell = text.trim();
  const left = cell.startsWith(":");
  const right = cell.endsWith(":") && cell.length > 1;
  return left && right ? "center" : left ? "left" : right ? "right" : "none";
}

function readTable(state: EditorState, node: SyntaxNode): Table {
  const rows: Row[] = [];
  for (const child of children(node)) {
    if (child.name === "TableDelimiter") {
      // The delimiter row is one node of dashes, colons and pipes.
      const text = state.sliceDoc(child.from, child.to);
      const pipes = [...text].flatMap((char, i) => (char === "|" ? [child.from + i] : []));
      rows.push({ from: child.from, to: child.to, cells: cellsBetween(child.from, child.to, pipes), delimiter: true });
    } else if (child.name === "TableHeader" || child.name === "TableRow") {
      const pipes = children(child).filter((part) => part.name === "TableDelimiter").map((part) => part.from);
      rows.push({ from: child.from, to: child.to, cells: cellsBetween(child.from, child.to, pipes), delimiter: false });
    }
  }
  const delimiter = rows.find((row) => row.delimiter);
  const aligns = delimiter ? delimiter.cells.map((cell) => alignOf(state.sliceDoc(cell.from, cell.to))) : [];
  return { rows, aligns };
}

type Spot = { table: Table; node: SyntaxNode; row: number; column: number };

/** The table, row and column a position is in. */
function spotAt(state: EditorState, pos: number): Spot | null {
  const tree = treeUpTo(state, state.doc.lineAt(pos).to);
  const node = ancestorNamed(tree, pos, TABLES, 1) ?? ancestorNamed(tree, pos, TABLES, -1);
  if (!node) return null;
  const table = readTable(state, node);
  const line = state.doc.lineAt(pos);
  const row = table.rows.findIndex((r) => state.doc.lineAt(r.from).number === line.number);
  if (row < 0) return null;
  const cells = table.rows[row]!.cells;
  const found = cells.findIndex((cell) => cell.from <= pos && pos <= cell.to);
  const column = found >= 0 ? found : pos < (cells[0]?.from ?? 0) ? 0 : cells.length - 1;
  return { table, node, row, column: Math.max(0, column) };
}

/** Whether the main cursor is in a table. */
export function inTable(state: EditorState): boolean {
  return spotAt(state, state.selection.main.head) !== null;
}

/** A command on the table at the main cursor. */
function tableCommand(
  build: (state: EditorState, spot: Spot) => TransactionSpec | null,
  isActive?: (state: EditorState, spot: Spot) => boolean,
): MarkdownCommand {
  return defineCommand({
    run: (state) => {
      const spot = spotAt(state, state.selection.main.head);
      return spot ? build(state, spot) : null;
    },
    ...(isActive && {
      isActive: (state: EditorState) => {
        const spot = spotAt(state, state.selection.main.head);
        return spot !== null && isActive(state, spot);
      },
    }),
  });
}

/** The index of the first body row, after the header and delimiter rows. */
const firstBody = (table: Table) => table.rows.findIndex((row) => row.delimiter) + 1;

/** The column count: the most cells in any row. */
const columnCount = (table: Table) => Math.max(...table.rows.map((row) => row.cells.length));

/** The quote markers before a row, which a new row repeats. */
function rowPrefix(state: EditorState, row: Row): string {
  return state.sliceDoc(state.doc.lineAt(row.from).from, row.from);
}

function emptyRow(columns: number): string {
  return `|${"  |".repeat(columns)}`;
}

function addRow(below: boolean) {
  return tableCommand((state, { table, row }) => {
    // From the header or delimiter, the row goes first in the body: never above them.
    const body = firstBody(table);
    const after = below || row < body;
    const anchor = table.rows[row < body ? body - 1 : row]!;
    const line = state.doc.lineAt(anchor.from);
    const text = rowPrefix(state, anchor) + emptyRow(columnCount(table));
    const insert = after ? state.lineBreak + text : text + state.lineBreak;
    const from = after ? line.to : line.from;
    const start = after ? from + 1 : from;
    const cell = start + rowPrefix(state, anchor).length + "| ".length;
    return { changes: { from, insert }, selection: EditorSelection.cursor(cell) };
  });
}

export const addRowAboveCommand = addRow(false);
export const addRowBelowCommand = addRow(true);

function addColumn(right: boolean) {
  return tableCommand((state, { table, row, column }) => {
    const changes: ChangeSpec[] = [];
    let cursor = 0;
    table.rows.forEach((r, index) => {
      const cell = r.cells[Math.min(column, r.cells.length - 1)];
      if (!cell) return;
      const fill = r.delimiter ? " --- " : "  ";
      const from = right || column >= r.cells.length ? cell.to : cell.from;
      const insert = right || column >= r.cells.length ? `|${fill}` : `${fill}|`;
      changes.push({ from, insert });
      if (index === row) cursor = from;
    });
    const set = state.changes(changes);
    // Into the new cell, past the pipe that opens it on the right.
    const offset = right ? "| ".length : " ".length;
    return { changes: set, selection: EditorSelection.cursor(set.mapPos(cursor, -1) + offset) };
  });
}

export const addColumnLeftCommand = addColumn(false);
export const addColumnRightCommand = addColumn(true);

export const deleteRowCommand = tableCommand((state, { table, row }) => {
  // A table needs its header and delimiter rows.
  if (row < firstBody(table)) return null;
  const line = state.doc.lineAt(table.rows[row]!.from);
  const from = line.number > 1 ? line.from - 1 : line.from;
  const to = line.number > 1 ? line.to : Math.min(line.to + 1, state.doc.length);
  return { changes: { from, to }, selection: EditorSelection.cursor(Math.max(0, from)) };
});

export const deleteColumnCommand = tableCommand((state, { table, column }) => {
  if (columnCount(table) <= 1) return null;
  const changes: ChangeSpec[] = [];
  for (const r of table.rows) {
    const cell = r.cells[column];
    if (!cell) continue;
    const next = r.cells[column + 1];
    const previous = r.cells[column - 1];
    // Take the cell with the pipe after it, or before it for the last cell.
    if (next) changes.push({ from: cell.from, to: next.from });
    else if (previous) changes.push({ from: previous.to, to: cell.to });
  }
  const set = state.changes(changes);
  return { changes: set, selection: state.selection.map(set) };
});

function delimiterCell(align: Align, width: number): string {
  const dashes = (n: number) => "-".repeat(Math.max(1, n));
  if (align === "left") return `:${dashes(width - 1)}`;
  if (align === "right") return `${dashes(width - 1)}:`;
  if (align === "center") return `:${dashes(width - 2)}:`;
  return dashes(width);
}

/** Sets a column's alignment, or takes it off when it's already that. */
function alignColumn(align: Exclude<Align, "none">): MarkdownCommand {
  return tableCommand(
    (state, { table, column }) => {
      const row = table.rows.find((r) => r.delimiter);
      const cell = row?.cells[column];
      if (!cell) return null;
      const text = state.sliceDoc(cell.from, cell.to);
      const content = text.trim();
      const lead = text.length - text.trimStart().length;
      const wanted = table.aligns[column] === align ? "none" : align;
      const insert = delimiterCell(wanted, Math.max(MIN_WIDTH, content.length));
      const set = state.changes({ from: cell.from + lead, to: cell.from + lead + content.length, insert });
      return { changes: set, selection: state.selection.map(set) };
    },
    (_state, { table, column }) => table.aligns[column] === align,
  );
}

export const alignColumnLeftCommand = alignColumn("left");
export const alignColumnCenterCommand = alignColumn("center");
export const alignColumnRightCommand = alignColumn("right");

function pad(text: string, width: number, align: Align): string {
  const space = width - text.length;
  if (align === "right") return " ".repeat(space) + text;
  if (align === "center") return " ".repeat(Math.floor(space / 2)) + text + " ".repeat(Math.ceil(space / 2));
  return text + " ".repeat(space);
}

/** Pads every cell to its column's width, aligned, with pipes at both ends. */
export const formatTableCommand = tableCommand((state) => {
  const result = state.changeByRange((range) => {
    const spot = spotAt(state, range.head);
    if (!spot) return { range };
    const { table } = spot;
    const columns = columnCount(table);
    const text = (row: Row, column: number) => {
      const cell = row.cells[column];
      return cell ? state.sliceDoc(cell.from, cell.to).trim() : "";
    };
    const widths = Array.from({ length: columns }, (_, column) =>
      Math.max(MIN_WIDTH, ...table.rows.filter((row) => !row.delimiter).map((row) => text(row, column).length)),
    );
    const align = (column: number) => table.aligns[column] ?? "none";
    const lines = table.rows.map((row) =>
      row.delimiter
        ? `| ${widths.map((width, column) => delimiterCell(align(column), width)).join(" | ")} |`
        : `| ${widths.map((width, column) => pad(text(row, column), width, align(column))).join(" | ")} |`,
    );

    // The cursor keeps its place in its cell's text.
    const row = table.rows[spot.row]!;
    const cell = row.cells[spot.column];
    const raw = cell ? state.sliceDoc(cell.from, cell.to) : "";
    const lead = raw.length - raw.trimStart().length;
    const within = cell ? Math.min(Math.max(0, range.head - cell.from - lead), raw.trim().length) : 0;
    const content = text(row, spot.column);
    const padding = pad(content, widths[spot.column]!, align(spot.column)).indexOf(content);
    const column = "| ".length + widths.slice(0, spot.column).reduce((sum, width) => sum + width + " | ".length, 0);

    const changes = state.changes(
      table.rows.flatMap((r, i) => (state.sliceDoc(r.from, r.to) === lines[i] ? [] : [{ from: r.from, to: r.to, insert: lines[i]! }])),
    );
    if (changes.empty) return { range };
    const rowStart = changes.mapPos(row.from, -1);
    const head = rowStart + column + (row.delimiter ? 0 : Math.max(0, padding)) + within;
    return { changes, range: EditorSelection.cursor(head) };
  });
  return result.changes.empty ? null : result;
});
