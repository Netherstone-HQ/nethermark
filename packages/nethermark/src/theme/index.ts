import { dark, light } from "./presets.js";

/** The neutral presets. Hosts build their own look on them with `extendTheme` and CSS. */
export const themes = { light, dark } as const;

export { extendTheme, type Theme } from "./theme.js";
