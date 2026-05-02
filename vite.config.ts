import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  // Our Vite root is `client/`, but `.env` lives in the repo root.
  // Point Vite at the correct env directory so `import.meta.env.VITE_*` resolves.
  envDir: path.resolve(import.meta.dirname),
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@supabase")) return "vendor-supabase";
          if (id.includes("node_modules/@tanstack")) return "vendor-query";
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/wouter")
          ) return "vendor-react";
        },
      },
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    // In dev, the client runs on Vite and the API runs on Express (PORT=3000).
    // Proxy /api/* so fetch("/api/...") never falls back to index.html.
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
