import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { kakuzukeQuestions } from "./src/question-set/vite-plugin.ts";

export default defineConfig({
  plugins: [
    kakuzukeQuestions(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart({ prerender: { enabled: true } }),
    react(),
  ],
});
