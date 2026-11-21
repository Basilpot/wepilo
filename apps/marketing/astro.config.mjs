// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// A static marketing site. It is built to ./dist and served by the Worker in
// src/worker.ts, the same way the dashboard is served.
export default defineConfig({
  output: "static",
  site: "https://wepilo.basilpot.com",
  build: { format: "directory" },
  vite: {
    plugins: [tailwindcss()],
  },
});
