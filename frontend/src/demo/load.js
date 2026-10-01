// Helpers for reading the bundled demo snapshot under `public/demo/`.
// The snapshot is produced by `backend/capture_demo.py`.

// BASE_URL always ends with "/", and already includes the GitHub Pages subpath.
// The `globalThis` fallback lets the Node test harness point at a preview URL.
const BASE =
  globalThis.__MP_DEMO_BASE__ ?? (import.meta.env && import.meta.env.BASE_URL) ?? "/";

const cache = new Map();

/** Load a snapshot file, memoised for the session. */
export function loadJSON(path) {
  let promise = cache.get(path);
  if (!promise) {
    promise = fetch(`${BASE}demo/${path}`).then((res) => {
      if (!res.ok) throw new Error(`Demo data not found: ${path}`);
      return res.json();
    });
    cache.set(path, promise);
  }
  return promise;
}

/** Filesystem-safe key for a symbol. Must match `slug()` in capture_demo.py. */
export function slug(symbol) {
  return String(symbol ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9.\-]/g, "");
}

/** Compact `[date,o,h,l,c,v]` rows -> chart point objects. */
export function toPoints(rows) {
  return (rows ?? []).map(([date, open, high, low, close, volume]) => ({
    date,
    open,
    high,
    low,
    close,
    volume,
  }));
}

const MONTHS = { "1mo": 1, "3mo": 3, "6mo": 6, "1y": 12, "2y": 24, "5y": 60, "10y": 120 };

/** Trim a daily (compact-array) series down to the requested period. */
export function sliceByPeriod(rows, period) {
  if (!rows?.length || period === "max") return rows ?? [];
  const last = new Date(rows[rows.length - 1][0]);
  let from;
  if (period === "1d") {
    from = new Date(last.getTime());
  } else if (period === "5d") {
    from = new Date(last);
    from.setDate(from.getDate() - 7);
  } else if (period === "ytd") {
    from = new Date(last.getFullYear(), 0, 1);
  } else {
    const months = MONTHS[period];
    if (!months) return rows;
    from = new Date(last);
    from.setMonth(from.getMonth() - months);
  }
  return rows.filter((row) => new Date(row[0]) >= from);
}

export const round2 = (value) =>
  value === null || value === undefined || Number.isNaN(value)
    ? null
    : Math.round(value * 100) / 100;
