import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Express serves public/welcome/ as a directory index; Vite's dev server does not and
// would hand /welcome/ to the React app. This makes dev answer the way production does.
const welcomeIndex = {
  name: "welcome-index",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (/^\/welcome\/?(\?.*)?$/.test(req.url))
        req.url = "/welcome/index.html";
      next();
    });
  },
};
export default defineConfig({
  plugins: [react(), welcomeIndex],
  // Object form on purpose: the string shorthand sets changeOrigin, which rewrites
  // Host to :3001 and makes the API's same-origin check reject every dev write.
  server: {
    proxy: { "/api": { target: "http://127.0.0.1:3001", changeOrigin: false } },
  },
});
