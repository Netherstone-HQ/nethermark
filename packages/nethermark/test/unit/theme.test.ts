import { describe, expect, test } from "vitest";
import { extendTheme, themes, type Theme } from "../../src/index.js";
import { cssVar, themeStyle } from "../../src/theme/theme.js";

/** Relative luminance of a #rrggbb color, as WCAG defines it. */
function luminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Not a #rrggbb color: ${hex}`);
  const [r, g, b] = match.slice(1).map((part) => {
    const c = Number.parseInt(part, 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA for normal text. */
const AA = 4.5;

/** Text tokens, and every background each can sit on. */
const PAIRS: [keyof Theme, (keyof Theme)[]][] = [
  ["foreground", ["background", "activeLine", "selection"]],
  ["gutterForeground", ["gutterBackground", "activeLine"]],
  ["buttonForeground", ["toolbarBackground", "buttonHover"]],
  ["buttonPressedForeground", ["buttonPressed"]],
  ...(["heading", "strong", "emphasis", "strike", "link", "url", "quote", "listMarker", "taskMarker", "markup", "tableBorder", "comment"] as const).map(
    (name): [keyof Theme, (keyof Theme)[]] => [name, ["background", "activeLine", "selection"]],
  ),
  ["code", ["codeBackground", "background", "activeLine", "selection"]],
];

describe.each(Object.entries(themes))("%s preset", (_, theme) => {
  test.each(PAIRS)("%s passes AA on its backgrounds", (text, backgrounds) => {
    for (const background of backgrounds) {
      const ratio = contrast(theme[text], theme[background]);
      expect(ratio, `${text} on ${background}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(AA);
    }
  });
});

describe("themes", () => {
  test("extendTheme changes only the tokens given", () => {
    const theme = extendTheme(themes.light, { link: "#000000" });
    expect(theme.link).toBe("#000000");
    expect(theme.heading).toBe(themes.light.heading);
    expect(themes.light.link).not.toBe("#000000");
  });

  test("tokens become CSS custom properties", () => {
    expect(cssVar("buttonPressedForeground")).toBe("--nme-button-pressed-foreground");
    expect(themeStyle(themes.light)).toContain("--nme-heading-scale: 1.1;");
    // The scheme isn't a token: it becomes the editor's color-scheme.
    expect(themeStyle(themes.light)).not.toContain("--nme-scheme");
    expect(themeStyle(themes.dark)).toContain("--nme-color-scheme: dark;");
  });

  test("both presets have every token", () => {
    expect(Object.keys(themes.dark).sort()).toEqual(Object.keys(themes.light).sort());
  });
});
