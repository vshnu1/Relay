import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  // Object form on purpose: the string shorthand sets changeOrigin, which rewrites
  // Host to :3001 and makes the API's same-origin check reject every dev write.
  server: {
    proxy: { "/api": { target: "http://127.0.0.1:3001", changeOrigin: false } },
  },
});
