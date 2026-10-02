import { isDark } from "../theme";

// Fixed series colors in a fixed order (validated for colour-blind separation on each surface). Dark
// mode uses deeper amber and green, which stay inside the readable lightness band on #1e1e1e.
const LIGHT_SERIES = ["#3b82f6", "#f59e0b", "#10b981"];
const DARK_SERIES = ["#3b82f6", "#d97706", "#059669"];

export function chartColors() {
  return isDark()
    ? { text: "#c9ccd1", grid: "rgba(255,255,255,0.08)", muted: "#8a8f98", series: DARK_SERIES }
    : { text: "#4b5563", grid: "rgba(0,0,0,0.06)", muted: "#9ca3af", series: LIGHT_SERIES };
}
