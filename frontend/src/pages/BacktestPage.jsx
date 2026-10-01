import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchBacktest } from "../api";
import useFetch from "../hooks/useFetch";
import PageHead from "../components/PageHead";
import Skeleton from "../components/Skeleton";
import ErrorState from "../components/ErrorState";
import StepperInput from "../components/StepperInput";
import useThemeColors from "../hooks/useThemeColors";
import { formatPrice } from "../utils";

const PERIODS = ["1y", "2y", "5y", "10y"];
const DEFAULTS = { ticker: "AAPL", fast: 20, slow: 50, period: "5y" };

function Metric({ label, value, sub, tone }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={tone ? { color: tone } : undefined}>
        {value}
      </span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="tooltip-date">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="ct-row">
          <span style={{ color: p.stroke }}>{p.name}</span>
          <b>{formatPrice(p.value)}</b>
        </div>
      ))}
    </div>
  );
}

export default function BacktestPage({ refreshKey, onSelect }) {
  const t = useThemeColors();
  const [form, setForm] = useState(DEFAULTS);
  const [params, setParams] = useState(DEFAULTS);
  const [formError, setFormError] = useState("");

  const key = JSON.stringify(params);
  const { data, loading, error, reload } = useFetch(() => fetchBacktest(params), [key, refreshKey]);

  const run = (e) => {
    e.preventDefault();
    const ticker = form.ticker.trim().toUpperCase();
    const fast = parseInt(form.fast, 10);
    const slow = parseInt(form.slow, 10);

    if (!ticker) return setFormError("Enter a ticker.");
    if (!Number.isInteger(fast) || fast < 2) return setFormError("Fast window must be ≥ 2.");
    if (!Number.isInteger(slow) || slow < 3) return setFormError("Slow window must be ≥ 3.");
    if (fast >= slow) return setFormError("Fast window must be smaller than the slow window.");

    setFormError("");
    setParams({ ticker, fast, slow, period: form.period });
  };

  const m = data?.metrics;
  const strat = m?.strategy;
  const bh = m?.buy_hold;
  const beat = strat && bh && strat.total_return_pct - bh.total_return_pct;

  return (
    <>
      <PageHead
        title="Strategy Backtest"
        subtitle="Backtest a simple SMA-crossover rule (long when the fast average is above the slow) against buy-and-hold."
      />

      <section className="card">
        <form className="bt-form" onSubmit={run}>
          <label className="sf-field">
            <span>Ticker</span>
            <input
              className="bt-ticker"
              type="text"
              value={form.ticker}
              onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value }))}
              placeholder="AAPL"
            />
          </label>
          <label className="sf-field">
            <span>Fast MA</span>
            <StepperInput
              className="bt-stepper"
              value={form.fast}
              onChange={(v) => setForm((f) => ({ ...f, fast: v }))}
              min={2}
              max={250}
              ariaLabel="Fast moving-average window"
            />
          </label>
          <label className="sf-field">
            <span>Slow MA</span>
            <StepperInput
              className="bt-stepper"
              value={form.slow}
              onChange={(v) => setForm((f) => ({ ...f, slow: v }))}
              min={3}
              max={300}
              ariaLabel="Slow moving-average window"
            />
          </label>
          <label className="sf-field">
            <span>Period</span>
            <select
              className="pf-input"
              value={form.period}
              onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary" type="submit">
            Run backtest
          </button>
        </form>
        {formError && <p className="pf-error bt-error">{formError}</p>}
      </section>

      {loading && <Skeleton height={420} />}
      {error && !data && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <>
          {/* Metrics */}
          <section className="card">
            <div className="card-head">
              <h2 className="card-title">
                Results — {data.ticker} · {data.fast}/{data.slow} crossover · {data.period}
              </h2>
              <span className="muted">
                {data.trades.length} trade{data.trades.length === 1 ? "" : "s"} · as of{" "}
                {new Date(data.as_of).toLocaleDateString()}
              </span>
            </div>
            <div className="stats-grid bt-metrics">
              <Metric
                label="Strategy return"
                value={`${strat.total_return_pct >= 0 ? "+" : ""}${formatPrice(strat.total_return_pct)}%`}
                sub={
                  beat == null
                    ? ""
                    : `${beat >= 0 ? "+" : ""}${formatPrice(beat)}% vs buy & hold`
                }
                tone={strat.total_return_pct >= 0 ? "var(--bullish)" : "var(--bearish)"}
              />
              <Metric
                label="Buy & hold return"
                value={`${bh.total_return_pct >= 0 ? "+" : ""}${formatPrice(bh.total_return_pct)}%`}
                tone={bh.total_return_pct >= 0 ? "var(--bullish)" : "var(--bearish)"}
              />
              <Metric label="Sharpe (strategy)" value={strat.sharpe ?? "—"} />
              <Metric
                label="Max drawdown"
                value={`${formatPrice(strat.max_drawdown_pct)}%`}
                tone="var(--bearish)"
              />
              <Metric label="Volatility (ann.)" value={`${formatPrice(strat.volatility_pct)}%`} />
              <Metric
                label="Win rate"
                value={strat.win_rate_pct == null ? "—" : `${formatPrice(strat.win_rate_pct)}%`}
              />
            </div>
          </section>

          {/* Equity curves */}
          <section className="card">
            <h2 className="card-title">Equity Curves (start = 100)</h2>
            <div className="bt-chart">
              <ResponsiveContainer width="100%" height={340}>
                <LineChart data={data.equity} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={t.grid}
                    vertical={false}
                    className="theme-grid"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: t.axis, fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={64}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fill: t.axis, fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="strategy"
                    name="Strategy"
                    stroke={t.accent}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="buy_hold"
                    name="Buy & hold"
                    stroke={t.muted}
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Trade ledger */}
          {data.trades.length > 0 && (
            <section className="card">
              <h2 className="card-title">Trade Ledger</h2>
              <div className="pf-table-wrap">
                <table className="pf-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Entry</th>
                      <th>Exit</th>
                      <th className="num">Held</th>
                      <th className="num">Return</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.trades.map((t, i) => (
                      <tr key={i}>
                        <td className="muted">{i + 1}</td>
                        <td>{t.entry_date}</td>
                        <td>{t.exit_date ?? "open"}</td>
                        <td className="num muted">{t.days}d</td>
                        <td className={`num ${t.return_pct >= 0 ? "up" : "down"}`}>
                          {t.return_pct >= 0 ? "+" : ""}
                          {formatPrice(t.return_pct)}%
                        </td>
                        <td className="pf-actions">
                          <button
                            type="button"
                            className="pf-icon-btn"
                            title={`Open ${data.ticker}`}
                            onClick={() => onSelect(data.ticker)}
                          >
                            ↗
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <p className="muted bt-disclaimer">
            Past performance does not guarantee future results. This backtest
            ignores fees, slippage, and dividends — it demonstrates the
            mechanics of the strategy, not an investable edge.
          </p>
        </>
      )}
    </>
  );
}
