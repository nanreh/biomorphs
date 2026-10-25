/// <reference types="vitest/config" />
import { resolve } from "node:path";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  base: "/hacks/biomorphs/",
  build: {
    rolldownOptions: {
      // Each page is its own HTML file, so about/ is a real folder on the web server and a
      // direct link to it or a reload works.
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        about: resolve(import.meta.dirname, "about/index.html"),
      },
    },
  },
});
