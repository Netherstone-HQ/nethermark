import { playwright } from "@vitest/browser-playwright";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const source = (path: string) => fileURLToPath(new URL(`../nethermark/src/${path}`, import.meta.url));

// REACT=18 runs the tests on React 18, installed beside 19 as react-18 and react-dom-18.
const react18 =
  process.env.REACT === "18"
    ? [
        { find: /^react(\/.*)?$/, replacement: "react-18$1" },
        { find: /^react-dom(\/.*)?$/, replacement: "react-dom-18$1" },
      ]
    : [];

export default defineConfig({
  // The React major the tests expect, so a run that should be on 18 can't pass on 19.
  define: { __REACT__: JSON.stringify(process.env.REACT ?? "19") },
  // Tests run against the editor's source, like the typecheck, so nothing has to be built first.
  resolve: {
    alias: [
      { find: /^@netherstone\/nethermark$/, replacement: source("index.ts") },
      { find: /^@netherstone\/nethermark\/preview$/, replacement: source("preview/index.ts") },
      ...react18,
    ],
  },
  test: {
    include: ["test/**/*.test.tsx"],
    setupFiles: ["test/setup.ts"],
    // In a real browser: CodeMirror measures layout, which a simulated DOM can't.
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: "chromium" }],
      screenshotFailures: false,
    },
  },
});
