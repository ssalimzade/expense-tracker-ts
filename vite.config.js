import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Dev server proxies API calls to the FastAPI backend on :8000 so the
// frontend can call `/api/...` without CORS issues during development.
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            "/api": {
                target: "http://localhost:8000",
                changeOrigin: true,
                rewrite: function (path) { return path.replace(/^\/api/, ""); },
            },
        },
    },
});
