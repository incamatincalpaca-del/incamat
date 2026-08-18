import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Necesario solo para pruebas mediante un túnel público temporal.
    allowedHosts: true,
    proxy: {
      "/api": process.env.VITE_PROXY_TARGET || "http://localhost:3000",
      "/uploads": process.env.VITE_PROXY_TARGET || "http://localhost:3000",
    },
  },
});
