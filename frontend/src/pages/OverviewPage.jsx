import { useState } from "react";
import {
  fetchChart,
  fetchHistory,
  fetchMarketSummary,
  fetchMovers,
  fetchNews,
  fetchSentiment,
} from "../api";
import useFetch from "../hooks/useFetch";
import PageHead from "../components/PageHead";
import SentimentGauge from "../components/SentimentGauge";
import MarketSummary from "../components/MarketSummary";
import NewsSentiment from "../components/NewsSentiment";
import MoversStrip from "../components/MoversStrip";
import Watchlist from "../components/Watchlist";
import ComponentBreakdown from "../components/ComponentBreakdown";
import HistoryChart from "../components/HistoryChart";
import CandlestickChart from "../components/CandlestickChart";
import PeriodSelector from "../components/PeriodSelector";
import Skeleton from "../components/Skeleton";
import ErrorState from "../components/ErrorState";
import { formatDate } from "../utils";

export default function OverviewPage({ refreshKey, onSelect, watchlist, onTogglePin, onRemoveWatchlist }) {
  const [period, setPeriod] = useState("1y");

  const sentiment = useFetch(() => fetchSentiment("1y"), [refreshKey]);
  const history = useFetch(() => fetchHistory(period), [period, refreshKey]);
  const summary = useFetch(fetchMarketSummary, [refreshKey]);
  const price = useFetch(() => fetchChart("^GSPC", period), [period, refreshKey]);
  const movers = useFetch(() => fetchMovers(5), [refreshKey]);
  const news = useFetch(() => fetchNews("market", 8), [refreshKey]);

  return (
    <>
      <PageHead
        title="Market Overview"
        subtitle="Composite sentiment, headline sentiment, and index action at a glance."
        right={
          sentiment.data && (
            <span className="muted">Updated {formatDate(sentiment.data.as_of)}</span>
          )
        }
      />

      {/* Hero: gauge + market overview */}
      <section className="hero">
        <div className="card card-gauge">
          <h2 className="card-title">Market Sentiment</h2>
          {sentiment.loading && <Skeleton height={260} />}
          {sentiment.error && (
            <ErrorState message={sentiment.error} onRetry={sentiment.reload} />
          )}
          {sentiment.data && <SentimentGauge data={sentiment.data} />}
        </div>

        <div className="card card-summary">
          <h2 className="card-title">Market Overview</h2>
          {summary.loading && <Skeleton height={260} />}
          {summary.error && (
            <ErrorState message={summary.error} onRetry={summary.reload} />
          )}
          {summary.data && <MarketSummary data={summary.data} />}
        </div>
      </section>

      {/* News sentiment */}
      <section className="card">
        <div className="card-head">
          <h2 className="card-title">News Sentiment</h2>
          <span className="muted">Recent market headlines, scored by VADER</span>
        </div>
        {news.loading && <Skeleton height={180} />}
        {news.error && <ErrorState message={news.error} onRetry={news.reload} />}
        {news.data && <NewsSentiment data={news.data} />}
      </section>

      {/* Market movers */}
      <section className="card">
        <h2 className="card-title">Market Movers</h2>
        {movers.loading && <Skeleton height={80} />}
        {movers.error && <ErrorState message={movers.error} onRetry={movers.reload} />}
        {movers.data && <MoversStrip data={movers.data} onSelect={onSelect} />}
      </section>

      {/* Watchlist */}
      <section className="card">
        <h2 className="card-title">Watchlist</h2>
        <Watchlist
          items={watchlist}
          onSelect={onSelect}
          onRemove={onRemoveWatchlist}
        />
      </section>

      {/* Signal breakdown */}
      <section className="card">
        <h2 className="card-title">Signal Breakdown</h2>
        {sentiment.loading && <Skeleton height={200} />}
        {sentiment.error && (
          <ErrorState message={sentiment.error} onRetry={sentiment.reload} />
        )}
        {sentiment.data && (
          <ComponentBreakdown
            summary={sentiment.data.summary}
            components={sentiment.data.components}
          />
        )}
      </section>

      {/* Sentiment trend */}
      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Sentiment Trend</h2>
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
        {history.loading && <Skeleton height={340} />}
        {history.error && (
          <ErrorState message={history.error} onRetry={history.reload} />
        )}
        {history.data && <HistoryChart data={history.data.points} />}
      </section>

      {/* S&P 500 price */}
      <section className="card">
        <div className="card-head">
          <h2 className="card-title">S&P 500 Price</h2>
          <span className="muted">^GSPC</span>
        </div>
        {price.loading && <Skeleton height={440} />}
        {price.error && <ErrorState message={price.error} onRetry={price.reload} />}
        {price.data && <CandlestickChart data={price.data.points} height={420} />}
      </section>
    </>
  );
}
