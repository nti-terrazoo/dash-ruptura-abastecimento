import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Bundle Chart.js separately from the app/vendor chunk - it's the
    // heaviest dependency and rarely changes, so it caches independently
    // across deploys.
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["chart.js"],
        },
      },
    },
  },
});
