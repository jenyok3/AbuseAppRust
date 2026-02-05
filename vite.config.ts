import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "client/src"),
      "@shared": path.resolve(process.cwd(), "shared"),
    },
  },
  root: "./client",
  build: {
    outDir: "./dist/public",
    emptyOutDir: true,
    assetsDir: "assets",
  },
  server: {
    port: 4000,
    host: true,
    hmr: {
      port: 4000,
    },
  },
  publicDir: "public",
});
