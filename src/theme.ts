// Ionic's dark.system palette follows the system theme in CSS; charts read it in JS.
const media = window.matchMedia("(prefers-color-scheme: dark)");

export const isDark = () => media.matches;
