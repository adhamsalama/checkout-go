/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // jeep-sqlite loads its Stencil chunks lazily; pre-bundling breaks that.
    exclude: ["jeep-sqlite"],
  },
  build: {
    rolldownOptions: {
      treeshake: {
        // @ionic/core doesn't declare sideEffects, so every component @ionic/react re-exports gets
        // bundled. Its per-component modules only define elements when called, so drop unused ones.
        moduleSideEffects: (id) => !/@ionic\/core\/components\/ion-[\w-]+\.js$/.test(id),
      },
    },
  },
  test: {
    environment: "node",
  },
});
