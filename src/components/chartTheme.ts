import { isDark } from "../theme";

// Fixed, distinguishable series colors (stable across renders, unlike random ones).
export const PALETTE = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#64748b"];

export function chartColors() {
  return isDark()
    ? { text: "#c9ccd1", grid: "rgba(255,255,255,0.08)" }
    : { text: "#4b5563", grid: "rgba(0,0,0,0.06)" };
}
