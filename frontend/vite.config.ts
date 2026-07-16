import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");

  return {
    base: env.VITE_BASE_PATH || "/",
    plugins: [react()],
    server: {
      proxy: {
        "/api": "http://127.0.0.1:8080",
        "/healthz": "http://127.0.0.1:8080"
      }
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
      css: true
    }
  };
});
