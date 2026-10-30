/**
 * A theme: every value the editor and toolbar are drawn with. The package
 * writes each token as a CSS custom property on the editor root, named
 * `--nme-` and the token in kebab case, and its CSS reads nothing else.
 */
export type Theme = {
  /** Whether the theme is light or dark, for the browser's own controls. */
  readonly scheme: "light" | "dark";

  // Surface
  readonly background: string;
  readonly foreground: string;
  readonly gutterBackground: string;
  readonly gutterForeground: string;
  readonly activeLine: string;
  readonly selection: string;
  readonly cursor: string;
  readonly border: string;

  // Toolbar
  readonly toolbarBackground: string;
  readonly buttonForeground: string;
  readonly buttonHover: string;
  readonly buttonPressed: string;
  readonly buttonPressedForeground: string;
  readonly focusRing: string;
  readonly separator: string;

  // Syntax
  readonly heading: string;
  readonly strong: string;
  readonly emphasis: string;
  readonly strike: string;
  readonly code: string;
  readonly codeBackground: string;
  readonly link: string;
  readonly url: string;
  readonly quote: string;
  readonly listMarker: string;
  readonly taskMarker: string;
  /** The `**`, `#` and `>` characters. */
  readonly markup: string;
  readonly tableBorder: string;
  /** HTML comments. */
  readonly comment: string;

  // Type
  readonly fontFamily: string;
  readonly monoFamily: string;
  readonly fontSize: string;
  readonly lineHeight: string;
  /** 1 keeps every line one size; above 1, an H<n> line is fontSize × headingScale^(6−n). */
  readonly headingScale: string;

  // Shape
  readonly radius: string;
  readonly buttonSize: string;
  readonly iconSize: string;
  readonly gap: string;
  readonly borderWidth: string;
  readonly focusRingWidth: string;
  readonly scrollbarThumb: string;
  readonly scrollbarThumbHover: string;
};

export type Token = Exclude<keyof Theme, "scheme">;

/** The CSS custom property that holds a token. */
export function cssVar(token: Token): string {
  return `--nme-${token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

/** A `var()` that reads a token. */
export function token(name: Token): string {
  return `var(${cssVar(name)})`;
}

/** The custom property that holds the theme's `color-scheme`. */
export const COLOR_SCHEME = "--nme-color-scheme";

/** Every token of a theme as CSS custom property declarations, for a `style` attribute. */
export function themeStyle(theme: Theme): string {
  const tokens = (Object.keys(theme) as (keyof Theme)[])
    .filter((key): key is Token => key !== "scheme")
    .map((key) => `${cssVar(key)}: ${theme[key]};`);
  return [...tokens, `${COLOR_SCHEME}: ${theme.scheme};`].join(" ");
}

/** A new theme from an existing one, with some tokens changed. */
export function extendTheme(base: Theme, overrides: Partial<Theme>): Theme {
  return { ...base, ...overrides };
}
