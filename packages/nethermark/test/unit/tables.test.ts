import { describe, expect, test } from "vitest";
import { commands } from "../../src/index.js";
import { run, stateOf } from "../notation.js";

describe("rows", () => {
  test.each([
    ["| a | b |\n| --- | --- |\n| c‸ | d |", commands.addRowBelow, "| a | b |\n| --- | --- |\n| c | d |\n| ‸ |  |"],
    ["| a | b |\n| --- | --- |\n| c‸ | d |", commands.addRowAbove, "| a | b |\n| --- | --- |\n| ‸ |  |\n| c | d |"],
    // From the header, the row goes first in the body.
    ["| a‸ | b |\n| --- | --- |\n| c | d |", commands.addRowAbove, "| a | b |\n| --- | --- |\n| ‸ |  |\n| c | d |"],
    ["| a‸ | b |\n| --- | --- |", commands.addRowBelow, "| a | b |\n| --- | --- |\n| ‸ |  |"],
    ["> | a | b |\n> | - | - |\n> | c‸ | d |", commands.addRowBelow, "> | a | b |\n> | - | - |\n> | c | d |\n> | ‸ |  |"],
    ["| a | b |\n| --- | --- |\n| c‸ | d |\n| e | f |", commands.deleteRow, "| a | b |\n| --- | --- |‸\n| e | f |"],
    // The header can't go.
    ["| a‸ | b |\n| --- | --- |", commands.deleteRow, null],
    ["te‸xt", commands.addRowBelow, null],
  ])("%j", (before, command, after) => {
    expect(run(command, before)).toBe(after);
  });
});

describe("columns", () => {
  test.each([
    ["| a‸ | b |\n| --- | --- |\n| c | d |", commands.addColumnRight, "| a | ‸ | b |\n| --- | --- | --- |\n| c |  | d |"],
    ["| a | b‸ |\n| --- | --- |\n| c | d |", commands.addColumnLeft, "| a | ‸ | b |\n| --- | --- | --- |\n| c |  | d |"],
    ["| a | b‸ |\n| --- | --- |\n| c | d |", commands.deleteColumn, "| a ‸|\n| --- |\n| c |"],
    ["| a‸ | b |\n| --- | --- |\n| c | d |", commands.deleteColumn, "|‸ b |\n| --- |\n| d |"],
    ["| a‸ |\n| --- |", commands.deleteColumn, null],
    // Escaped pipes stay in their cell.
    ["| a \\| x‸ | b |\n| --- | --- |", commands.deleteColumn, "|‸ b |\n| --- |"],
  ])("%j", (before, command, after) => {
    expect(run(command, before)).toBe(after);
  });
});

describe("alignment", () => {
  test.each([
    [commands.alignColumnLeft, "| a | b‸ |\n| --- | :-- |"],
    [commands.alignColumnCenter, "| a | b‸ |\n| --- | :-: |"],
    [commands.alignColumnRight, "| a | b‸ |\n| --- | --: |"],
  ])("%#", (command, after) => {
    expect(run(command, "| a | b‸ |\n| --- | --- |")).toBe(after);
    // Again takes it off.
    expect(run(command, after)).toBe("| a | b‸ |\n| --- | --- |");
  });

  test("is active on the column's alignment", () => {
    expect(commands.alignColumnRight.isActive?.(stateOf("| a | b‸ |\n| --- | --: |"))).toBe(true);
    expect(commands.alignColumnRight.isActive?.(stateOf("| a‸ | b |\n| --- | --: |"))).toBe(false);
  });
});

describe("format", () => {
  test.each([
    ["a | long‸ header\n-|-\nc | d", "| a   | long‸ header |\n| --- | ----------- |\n| c   | d           |"],
    ["| x‸ | y |\n| :-: | --: |\n| wide | z |", "|  x‸   |   y |\n| :--: | --: |\n| wide |   z |"],
    // Ragged rows get the missing cells.
    ["| a‸ | b |\n| - | - |\n| c |", "| a‸   | b   |\n| --- | --- |\n| c   |     |"],
  ])("%j", (before, after) => {
    expect(run(commands.formatTable, before)).toBe(after);
  });

  test("leaves a formatted table as it is", () => {
    const formatted = "| a‸   | b   |\n| --- | --- |\n| c   | d   |";
    expect(run(commands.formatTable, formatted)).toBe(null);
  });
});

