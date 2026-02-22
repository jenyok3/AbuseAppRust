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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("@tanstack")) return "vendor-tanstack";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("recharts")) return "vendor-charts";
          if (id.includes("lucide-react") || id.includes("react-icons")) return "vendor-icons";
          if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "vendor-react";

          return "vendor";
        },
      },
    },
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
