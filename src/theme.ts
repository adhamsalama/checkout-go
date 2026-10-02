const media = window.matchMedia("(prefers-color-scheme: dark)");

/** Follows the system light/dark setting via Bootstrap's data-bs-theme. */
export function followSystemTheme() {
  const apply = () =>
    document.documentElement.setAttribute("data-bs-theme", media.matches ? "dark" : "light");
  apply();
  media.addEventListener("change", apply);
}

export const isDark = () => media.matches;
