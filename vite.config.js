import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Tauri 开发时对 frontend dist
  server: {
    port: 1420,
    strictPort: true,
  },
  // http://localhost:1420
  build: {
    outDir: "dist",
    emptyOutDir: true
  },
});
