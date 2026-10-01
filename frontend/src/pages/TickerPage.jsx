import { useState } from "react";
import { fetchChart, fetchNews, fetchTicker } from "../api";
import useFetch from "../hooks/useFetch";
import CandlestickChart from "../components/CandlestickChart";
import NewsSentiment from "../components/NewsSentiment";
import Skeleton from "../components/Skeleton";
import ErrorState from "../components/ErrorState";
import PeriodSelector from "../components/PeriodSelector";
import { StarIcon } from "../components/Icons";
import { formatLarge, formatPrice } from "../utils";

const PERIODS = [
  { value: "1d", label: "1D" },
  { value: "5d", label: "5D" },
  { value: "1mo", label: "1M" },
  { value: "6mo", label: "6M" },
  { value: "ytd", label: "YTD" },
  { value: "1y", label: "1Y" },
  { value: "5y", label: "5Y" },
  { value: "max", label: "Max" },
];

// Sensible intraday interval per window (Yahoo-style).
const INTERVAL_FOR = { "1d": "5m", "5d": "15m", "1mo": "60m" };

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

export default function TickerPage({ symbol, onTogglePin, isPinned }) {
  const [period, setPeriod] = useState("6mo");
  const interval = INTERVAL_FOR[period] || "1d";
  const intraday = period === "1d" || period === "5d";

  // Quote + stats always come from a 1y daily series, so they stay stable
  // while the chart window changes.
  const detail = useFetch(() => fetchTicker(symbol, "1y", "1d"), [symbol]);
  const chart = useFetch(() => fetchChart(symbol, period, interval), [symbol, period, interval]);
  const news = useFetch(() => fetchNews(symbol, 8), [symbol]);

  const info = detail.data?.info;
  const stats = detail.data?.stats;
  const up = info?.change == null ? null : info.change >= 0;

  return (
    <>
      <div className="ticker-head">
        <div className="ticker-id">
          <a className="back-link" href="#/overview">
            ‹ Back
          </a>
          <h2 className="page-title">{symbol}</h2>
          <p className="page-subtitle">{info?.name}</p>
        </div>
        <div className="ticker-quote">
          {detail.loading && <Skeleton height={44} width={220} />}
          {detail.error && <ErrorState message={detail.error} onRetry={detail.reload} />}
          {detail.data && (
            <>
              <span className="ticker-price">{formatPrice(info.price)}</span>
              <span className={`ticker-change ${up ? "up" : "down"}`}>
                {up ? "+" : ""}
                {formatPrice(info.change)} ({up ? "+" : ""}
                {formatPrice(info.change_pct)}%)
              </span>
              {info.currency && <span className="muted">{info.currency}</span>}
              <button
                className="btn"
                onClick={() => onTogglePin(symbol, info.name)}
                title={isPinned ? "Remove from watchlist" : "Add to watchlist"}
              >
                <StarIcon filled={isPinned} />
                {isPinned ? "Pinned" : "Pin"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Price history + news side by side on wide screens */}
      <div className="ticker-main">
        <section className="card ticker-chart">
          <div className="card-head">
            <span className="muted">Price history</span>
            <PeriodSelector value={period} onChange={setPeriod} periods={PERIODS} />
          </div>
          {chart.loading && <Skeleton height={520} />}
          {chart.error && <ErrorState message={chart.error} onRetry={chart.reload} />}
          {chart.data && (
            <CandlestickChart
              data={chart.data.points}
              height={520}
              defaultOverlays={
                intraday ? { sma20: false, sma50: false, bollinger: false } : undefined
              }
            />
          )}
        </section>

        <section className="card ticker-news">
          <h2 className="card-title">News Sentiment</h2>
          {news.loading && <Skeleton height={520} />}
          {news.error && <ErrorState message={news.error} onRetry={news.reload} />}
          {news.data && <NewsSentiment data={news.data} />}
        </section>
      </div>

      <section className="card">
        <h2 className="card-title">Key Stats</h2>
        {detail.loading && <Skeleton height={120} />}
        {detail.error && <ErrorState message={detail.error} onRetry={detail.reload} />}
        {detail.data && (
          <div className="stats-grid">
            <Stat label="Market Cap" value={formatLarge(stats.market_cap)} />
            <Stat label="P/E" value={stats.pe_ratio != null ? stats.pe_ratio.toFixed(1) : "—"} />
            <Stat label="RSI (14)" value={stats.rsi14 != null ? stats.rsi14.toFixed(1) : "—"} />
            <Stat label="50-day MA" value={formatPrice(stats.sma50)} />
            <Stat label="200-day MA" value={formatPrice(stats.sma200)} />
            <Stat label="52w High" value={formatPrice(stats.fifty_two_week_high)} />
            <Stat label="52w Low" value={formatPrice(stats.fifty_two_week_low)} />
            <Stat label="Avg Volume" value={formatLarge(stats.avg_volume)} />
          </div>
        )}
      </section>
    </>
  );
}
