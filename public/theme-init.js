(() => {
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  let preference = "system";

  try {
    const saved = localStorage.getItem("ohio-theme");
    if (saved === "light" || saved === "dark") preference = saved;
  } catch {
    // Theme selection remains available for this page when storage is blocked.
  }

  root.dataset.themePreference = preference;

  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    const color = theme === "dark" ? "#11161d" : "#fafafa";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", color);
  };

  applyTheme(
    preference === "system" ? (media.matches ? "dark" : "light") : preference,
  );

  media.addEventListener("change", ({ matches }) => {
    if (root.dataset.themePreference === "system")
      applyTheme(matches ? "dark" : "light");
  });
})();
