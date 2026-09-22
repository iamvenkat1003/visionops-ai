import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["recharts"],
          vendor: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
  server: {
    strictPort: true,
    proxy: {
      "/api": { target: "http://127.0.0.1:8000" },
      "/metrics": { target: "http://127.0.0.1:8000" },
    },
  },
});
