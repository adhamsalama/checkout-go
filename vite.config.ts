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
  test: {
    environment: "node",
  },
});
