// Client-side stock screener. Mirrors `backend/app/screener.py` so filtering
// and sorting behave exactly like the live API, over the bundled universe.

const SORT_KEYS = new Set([
  "symbol",
  "price",
  "change_pct",
  "rsi14",
  "pct_from_high",
  "momentum_1m_pct",
  "momentum_3m_pct",
  "volatility_30d_pct",
  "rel_volume",
]);

function num(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function bool(value) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
}

/** Filter, sort and paginate snapshot rows. Throws on invalid args, like the API. */
export function screen(rows, params = {}, asOf = null) {
  const sortBy = params.sort_by || "symbol";
  if (!SORT_KEYS.has(sortBy)) {
    throw new Error(`Invalid sort_by '${sortBy}'.`);
  }
  const order = params.order || "asc";
  if (order !== "asc" && order !== "desc") {
    throw new Error("Invalid order. Use 'asc' or 'desc'.");
  }
  const limit = num(params.limit) ?? 50;

  const rsiMin = num(params.rsi_min);
  const rsiMax = num(params.rsi_max);
  const above50 = bool(params.above_sma50);
  const above200 = bool(params.above_sma200);
  const withinHigh = num(params.within_high_pct);
  const changeMin = num(params.change_min);
  const changeMax = num(params.change_max);
  const priceMin = num(params.price_min);
  const priceMax = num(params.price_max);
  const momMin = num(params.momentum_1m_min);
  const momMax = num(params.momentum_1m_max);
  const volMin = num(params.volatility_min);
  const volMax = num(params.volatility_max);
  const relVolMin = num(params.rel_volume_min);
  const avgVolMin = num(params.avg_volume_min);

  const keep = (row) => {
    if (rsiMin !== null && (row.rsi14 === null || row.rsi14 < rsiMin)) return false;
    if (rsiMax !== null && (row.rsi14 === null || row.rsi14 > rsiMax)) return false;
    if (above50 !== null && row.above_sma50 !== above50) return false;
    if (above200 !== null && row.above_sma200 !== above200) return false;
    if (withinHigh !== null && (row.pct_from_high === null || row.pct_from_high < -withinHigh)) return false;
    if (changeMin !== null && (row.change_pct === null || row.change_pct < changeMin)) return false;
    if (changeMax !== null && (row.change_pct === null || row.change_pct > changeMax)) return false;
    if (priceMin !== null && (row.price === null || row.price < priceMin)) return false;
    if (priceMax !== null && (row.price === null || row.price > priceMax)) return false;
    if (momMin !== null && (row.momentum_1m_pct === null || row.momentum_1m_pct < momMin)) return false;
    if (momMax !== null && (row.momentum_1m_pct === null || row.momentum_1m_pct > momMax)) return false;
    if (volMin !== null && (row.volatility_30d_pct === null || row.volatility_30d_pct < volMin)) return false;
    if (volMax !== null && (row.volatility_30d_pct === null || row.volatility_30d_pct > volMax)) return false;
    if (relVolMin !== null && (row.rel_volume === null || row.rel_volume < relVolMin)) return false;
    if (avgVolMin !== null && (row.avg_volume_30d === null || row.avg_volume_30d < avgVolMin)) return false;
    return true;
  };

  const filtered = rows.filter(keep);

  // Rows with a missing sort value go last, regardless of direction.
  const present = filtered.filter((r) => r[sortBy] !== null && r[sortBy] !== undefined);
  const missing = filtered.filter((r) => r[sortBy] === null || r[sortBy] === undefined);
  const cmp =
    sortBy === "symbol"
      ? (a, b) => String(a.symbol).localeCompare(String(b.symbol))
      : (a, b) => a[sortBy] - b[sortBy];
  present.sort((a, b) => (order === "desc" ? -cmp(a, b) : cmp(a, b)));

  const ordered = present.concat(missing);
  return { as_of: asOf, count: ordered.length, results: ordered.slice(0, limit) };
}
