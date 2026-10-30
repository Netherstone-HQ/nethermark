import { defineConfig } from "vite";

/** Serves the fixture page the browser tests load. */
export default defineConfig({
  root: new URL("./fixture", import.meta.url).pathname,
  server: { port: 5199, strictPort: true },
  logLevel: "warn",
});
