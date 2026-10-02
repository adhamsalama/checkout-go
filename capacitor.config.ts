import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "dev.adhamsalama.checkout",
  appName: "Checkout",
  webDir: "dist",
  plugins: {
    // Edge-to-edge: the web app pads its top/tab bars with the injected --safe-area-inset-* values.
    SystemBars: { insetsHandling: "css", initialViewportFitValueHint: "cover" },
  },
};

export default config;
