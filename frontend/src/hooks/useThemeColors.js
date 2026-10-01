import { useEffect, useState } from "react";

// Resolves the theme's CSS custom properties to concrete color strings.
//
// Charting libraries set colors as SVG *attributes* (gradient stops, Recharts
// strokes/ticks), and `var(--x)` is not valid there — unlike the `style` prop,
// which does resolve custom properties. This hook reads the live values and
// re-reads them whenever the theme attribute changes.
const VARS = {
  accent: "--accent",
  accentContrast: "--accent-contrast",
  bull: "--bullish",
  bear: "--bearish",
  neutral: "--neutral",
  up: "--up",
  down: "--down",
  grid: "--chart-grid",
  axis: "--chart-axis",
  text: "--chart-text",
  crosshair: "--chart-crosshair",
  muted: "--muted",
  border: "--border",
  surface: "--surface",
};

function read() {
  const styles = getComputedStyle(document.documentElement);
  const out = {};
  for (const [key, name] of Object.entries(VARS)) {
    out[key] = styles.getPropertyValue(name).trim();
  }
  return out;
}

export default function useThemeColors() {
  const [colors, setColors] = useState(read);

  useEffect(() => {
    const observer = new MutationObserver(() => setColors(read()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}
