import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const fixture = new URL("./fixture", import.meta.url).pathname;

/** Serves the fixture pages the browser tests load. Tailwind only builds the CSS files that import it. */
export default defineConfig({
  root: fixture,
  plugins: [tailwindcss()],
  server: { port: 5199, strictPort: true },
  logLevel: "warn",
});
