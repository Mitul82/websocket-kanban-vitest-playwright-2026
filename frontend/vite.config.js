import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    open: true,
    hmr: {
      protocol: 'ws',
      host: '127.0.0.1',
      port: 5173,
    },
  },
  preview: {
    port: 5173,
    strictPort: true,
    open: true,
  },
  test: {
    mockReset: true,
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.js",
    // avoid long-running hangs in CI and developer runs by setting reasonable timeouts
    timeout: 10000,
    hookTimeout: 10000,
    exclude: ["node_modules", "src/tests/e2e"],
  },
});
