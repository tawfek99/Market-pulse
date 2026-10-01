// Shared formatting + styling helpers.

// Referenced from CSS `style` props, so these theme variables resolve live.
export const CATEGORY_COLORS = {
  Bullish: "var(--bullish)",
  Neutral: "var(--neutral)",
  Bearish: "var(--bearish)",
};

const DETAIL_LABELS = {
  vix: "VIX",
  vix_20d_ago: "VIX (20d ago)",
  change_20d: "20-day change",
  pct_above_50d_ma: "% above 50-day MA",
  spx: "S&P 500",
  above_50d: "Above 50-day MA",
  above_200d: "Above 200-day MA",
  momentum_20d_pct: "20-day momentum",
  pct_from_52w_high: "% from 52-week high",
};

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPrice(value) {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function formatLarge(value) {
  if (value === null || value === undefined) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e12) return (value / 1e12).toFixed(2) + "T";
  if (abs >= 1e9) return (value / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (value / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (value / 1e3).toFixed(1) + "K";
  return String(value);
}

export function formatShortDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function timeAgo(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function formatKey(key) {
  return DETAIL_LABELS[key] ?? key.replace(/_/g, " ");
}

export function formatValue(value, key = "") {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    const s = value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return /pct|momentum|change/i.test(key) ? `${s}%` : s;
  }
  return String(value);
}
