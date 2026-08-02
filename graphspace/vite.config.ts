import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const apiPort = Number(process.env.SPECSPACE_API_PORT ?? process.env.API_PORT ?? 8001);

if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) {
  throw new Error("SPECSPACE_API_PORT/API_PORT must be an integer between 1 and 65535.");
}

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 5175,
    strictPort: true,
    // Proxy /api to the selected SpecSpace backend so isolated local profiles
    // can avoid the default operator ports.
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
});
