import { useState } from "react";
import { fetchScreener } from "../api";
import useFetch from "../hooks/useFetch";
import StepperInput from "./StepperInput";
import { formatPrice } from "../utils";

const EMPTY_FILTERS = {
  rsi_min: "",
  rsi_max: "",
  above_sma50: "",
  above_sma200: "",
  within_high_pct: "",
  change_min: "",
  change_max: "",
  price_min: "",
  price_max: "",
  momentum_1m_min: "",
  volatility_max: "",
  rel_volume_min: "",
  sort_by: "symbol",
  order: "asc",
};

const PRESETS = [
  { label: "All", filters: {} },
  { label: "Oversold (RSI < 30)", filters: { rsi_max: 30 } },
  { label: "Overbought (RSI > 70)", filters: { rsi_min: 70 } },
  { label: "Near 52-week high", filters: { within_high_pct: 5 } },
  { label: "Uptrend (above 200d)", filters: { above_sma200: true } },
  { label: "Downtrend (below 200d)", filters: { above_sma200: false } },
  { label: "Gainers today (≥ 2%)", filters: { change_min: 2 } },
  { label: "Losers today (≤ −2%)", filters: { change_max: -2 } },
  { label: "Unusual volume (≥ 1.5×)", filters: { rel_volume_min: 1.5 } },
  { label: "Momentum (1m ≥ 5%)", filters: { momentum_1m_min: 5 } },
  { label: "Low volatility (≤ 20%)", filters: { volatility_max: 20 } },
];

function rsiClass(rsi) {
  if (rsi == null) return "";
  if (rsi >= 70) return "overbought";
  if (rsi <= 30) return "oversold";
  return "";
}

export default function Screener({ refreshKey, onSelect }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [activePreset, setActivePreset] = useState("All");
  const [showFilters, setShowFilters] = useState(true);

  const key = JSON.stringify(applied);
  const screener = useFetch(() => fetchScreener(applied), [key, refreshKey]);

  const set = (name, value) => setFilters((f) => ({ ...f, [name]: value }));

  const applyPreset = (preset) => {
    const next = { ...EMPTY_FILTERS, ...preset.filters };
    setActivePreset(preset.label);
    setFilters(next);
    setApplied(next);
  };

  const apply = (e) => {
    e.preventDefault();
    setActivePreset("");
    setApplied({ ...filters });
  };

  const clear = () => {
    setActivePreset("All");
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
  };

  const sortBy = (column) => {
    const next =
      filters.sort_by === column && filters.order === "asc"
        ? { sort_by: column, order: "desc" }
        : { sort_by: column, order: "asc" };
    const merged = { ...filters, ...next };
    setFilters(merged);
    setApplied(merged);
    setActivePreset("");
  };

  const header = (column, label, className = "") => {
    const active = applied.sort_by === column;
    const arrow = active ? (applied.order === "asc" ? "↑" : "↓") : "";
    return (
      <th
        className={className}
        aria-sort={active ? (applied.order === "asc" ? "ascending" : "descending") : undefined}
      >
        <button className="screener-sort" onClick={() => sortBy(column)}>
          {label} {arrow && <span className="sort-arrow">{arrow}</span>}
        </button>
      </th>
    );
  };

  const checkbox = (name, labelText) => (
    <label className="sf-check">
      <input
        type="checkbox"
        checked={filters[name] === true}
        onChange={(e) => set(name, e.target.checked ? true : "")}
      />
      {labelText}
    </label>
  );

  return (
    <div className="screener">
      <div className="screener-presets">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className={`btn preset ${activePreset === p.label ? "preset-active" : ""}`}
            onClick={() => applyPreset(p)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="btn filters-toggle"
        onClick={() => setShowFilters((s) => !s)}
        aria-expanded={showFilters}
      >
        {showFilters ? "▾ Hide filters" : "▸ Show filters"}
      </button>

      {showFilters && (
        <form className="screener-filters" onSubmit={apply}>
          <div className="sf-grid">
            <label className="sf-field">
              <span>RSI min</span>
              <StepperInput
                className="sf-stepper"
                value={filters.rsi_min}
                onChange={(v) => set("rsi_min", v)}
                placeholder="0"
                min={0}
                max={100}
                ariaLabel="Minimum RSI"
              />
            </label>
            <label className="sf-field">
              <span>RSI max</span>
              <StepperInput
                className="sf-stepper"
                value={filters.rsi_max}
                onChange={(v) => set("rsi_max", v)}
                placeholder="100"
                min={0}
                max={100}
                ariaLabel="Maximum RSI"
              />
            </label>
            <label className="sf-field">
              <span>Day change ≥ %</span>
              <StepperInput
                className="sf-stepper"
                value={filters.change_min}
                onChange={(v) => set("change_min", v)}
                placeholder="0"
                ariaLabel="Minimum day change percent"
              />
            </label>
            <label className="sf-field">
              <span>Day change ≤ %</span>
              <StepperInput
                className="sf-stepper"
                value={filters.change_max}
                onChange={(v) => set("change_max", v)}
                placeholder="0"
                ariaLabel="Maximum day change percent"
              />
            </label>
            <label className="sf-field">
              <span>Price ≥ $</span>
              <StepperInput
                className="sf-stepper"
                value={filters.price_min}
                onChange={(v) => set("price_min", v)}
                placeholder="0"
                min={0}
                step={5}
                ariaLabel="Minimum price"
              />
            </label>
            <label className="sf-field">
              <span>Price ≤ $</span>
              <StepperInput
                className="sf-stepper"
                value={filters.price_max}
                onChange={(v) => set("price_max", v)}
                placeholder="—"
                min={0}
                step={5}
                ariaLabel="Maximum price"
              />
            </label>
            <label className="sf-field">
              <span>1M momentum ≥ %</span>
              <StepperInput
                className="sf-stepper"
                value={filters.momentum_1m_min}
                onChange={(v) => set("momentum_1m_min", v)}
                placeholder="0"
                ariaLabel="Minimum 1-month momentum percent"
              />
            </label>
            <label className="sf-field">
              <span>Volatility ≤ %</span>
              <StepperInput
                className="sf-stepper"
                value={filters.volatility_max}
                onChange={(v) => set("volatility_max", v)}
                placeholder="—"
                min={0}
                max={500}
                ariaLabel="Maximum annualized volatility percent"
              />
            </label>
            <label className="sf-field">
              <span>Rel. volume ≥ ×</span>
              <StepperInput
                className="sf-stepper"
                value={filters.rel_volume_min}
                onChange={(v) => set("rel_volume_min", v)}
                placeholder="1"
                min={0}
                step={0.5}
                ariaLabel="Minimum relative volume multiple"
              />
            </label>
            <label className="sf-field">
              <span>% from 52w high ≤</span>
              <StepperInput
                className="sf-stepper"
                value={filters.within_high_pct}
                onChange={(v) => set("within_high_pct", v)}
                placeholder="10"
                min={0}
                max={100}
                ariaLabel="Maximum distance from 52-week high"
              />
            </label>
            <div className="sf-checks">
              {checkbox("above_sma50", "Above 50d MA")}
              {checkbox("above_sma200", "Above 200d MA")}
            </div>
          </div>

          <div className="sf-actions">
            <button className="btn btn-primary" type="submit">
              Apply
            </button>
            <button className="btn" type="button" onClick={clear}>
              Reset
            </button>
          </div>
        </form>
      )}

      {screener.loading && <div className="muted sf-hint">Scanning universe…</div>}
      {screener.error && <p className="pf-error">{screener.error}</p>}

      {screener.data && (
        <>
          <div className="sf-meta muted">
            {screener.data.count} match{screener.data.count === 1 ? "" : "es"}
            {screener.data.as_of && <> · as of {new Date(screener.data.as_of).toLocaleDateString()}</>}
          </div>

          {screener.data.results.length === 0 ? (
            <div className="muted sf-hint">No tickers match those filters — try loosening them.</div>
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table screener-table">
                <thead>
                  <tr>
                    {header("symbol", "Symbol")}
                    <th className="sf-name-col">Name</th>
                    {header("price", "Price", "num")}
                    {header("change_pct", "Day %", "num")}
                    {header("momentum_1m_pct", "1M mom", "num")}
                    {header("rsi14", "RSI", "num")}
                    {header("volatility_30d_pct", "Vol %", "num")}
                    {header("rel_volume", "Rel vol", "num")}
                    <th className="num">50d</th>
                    <th className="num">200d</th>
                    {header("pct_from_high", "52w high", "num")}
                  </tr>
                </thead>
                <tbody>
                  {screener.data.results.map((r) => (
                    <tr key={r.symbol} className="screener-row" onClick={() => onSelect(r.symbol)}>
                      <td>
                        <strong>{r.symbol}</strong>
                      </td>
                      <td className="sf-name-col muted">{r.name}</td>
                      <td className="num">{formatPrice(r.price)}</td>
                      <td className={`num ${r.change_pct == null ? "" : r.change_pct >= 0 ? "up" : "down"}`}>
                        {r.change_pct == null ? "—" : `${r.change_pct >= 0 ? "+" : ""}${formatPrice(r.change_pct)}%`}
                      </td>
                      <td className={`num ${r.momentum_1m_pct == null ? "" : r.momentum_1m_pct >= 0 ? "up" : "down"}`}>
                        {r.momentum_1m_pct == null ? "—" : `${r.momentum_1m_pct >= 0 ? "+" : ""}${formatPrice(r.momentum_1m_pct)}%`}
                      </td>
                      <td className={`num rsi ${rsiClass(r.rsi14)}`}>
                        {r.rsi14 == null ? "—" : formatPrice(r.rsi14)}
                      </td>
                      <td className="num">{r.volatility_30d_pct == null ? "—" : `${formatPrice(r.volatility_30d_pct)}%`}</td>
                      <td className="num">{r.rel_volume == null ? "—" : `${formatPrice(r.rel_volume)}×`}</td>
                      <td className="num">{r.above_sma50 == null ? "—" : r.above_sma50 ? "✓" : "✕"}</td>
                      <td className="num">{r.above_sma200 == null ? "—" : r.above_sma200 ? "✓" : "✕"}</td>
                      <td className={`num ${r.pct_from_high == null ? "" : r.pct_from_high >= -5 ? "up" : r.pct_from_high <= -25 ? "down" : ""}`}>
                        {r.pct_from_high == null ? "—" : `${formatPrice(r.pct_from_high)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
