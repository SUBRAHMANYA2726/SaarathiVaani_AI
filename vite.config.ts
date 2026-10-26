import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const apiProxyTarget = process.env.API_PROXY_TARGET || "http://127.0.0.1:4174";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { "/api": apiProxyTarget, "/downloads": apiProxyTarget },
  },
  build: { outDir: "dist", sourcemap: true },
});
