// Self-contained demo data layer. Every function here mirrors the live API
// surface in `./live.js`, but reads the frozen snapshot under `public/demo/`
// and recomputes the rule-based parts (screener, backtest) in the browser.
import { loadJSON, round2, slug, sliceByPeriod, toPoints } from "../demo/load.js";
import { screen } from "../demo/screener.js";
import { runBacktest } from "../demo/backtest.js";
import {
  addHolding,
  deleteHolding,
  fetchPortfolio,
  updateHolding,
} from "../demo/portfolio.js";

export const IS_DEMO = true;

async function chartFile(symbol) {
  try {
    return await loadJSON(`charts/${slug(symbol)}.json`);
  } catch {
    throw new Error(`No demo data for '${symbol}'.`);
  }
}

export async function fetchSentiment(_period = "1y") {
  return loadJSON("sentiment.json");
}

export async function fetchHistory(period = "1y") {
  const history = await loadJSON("history.json");
  return history[period] ?? history["1y"];
}

export async function fetchMarketSummary() {
  return loadJSON("summary.json");
}

export async function fetchChart(ticker, period = "6mo", _interval = "1d") {
  const chart = await chartFile(ticker);
  const intraday = chart.intraday?.[period];
  const rows = intraday ? intraday.points : sliceByPeriod(chart.daily.points, period);
  return { ticker, period, points: toPoints(rows) };
}

export async function fetchTicker(ticker) {
  try {
    const detail = await loadJSON(`tickers/${slug(ticker)}.json`);
    return {
      info: detail.info,
      stats: detail.stats,
      chart: toPoints(detail.chart),
    };
  } catch {
    throw new Error(`No demo data for '${ticker}'.`);
  }
}

export async function searchTickers(query, limit = 8) {
  const index = await loadJSON("index.json");
  const q = String(query).trim().toUpperCase();
  if (!q) return { results: [] };

  const scored = [];
  for (const item of index.symbols) {
    const symbol = item.symbol.toUpperCase();
    const name = (item.name || "").toUpperCase();
    let score = -1;
    if (symbol.startsWith(q)) score = 0;
    else if (name.startsWith(q)) score = 1;
    else if (symbol.includes(q)) score = 2;
    else if (name.includes(q)) score = 3;
    if (score >= 0) scored.push({ score, item });
  }
  scored.sort((a, b) => a.score - b.score || a.item.symbol.localeCompare(b.item.symbol));

  return {
    results: scored.slice(0, limit).map(({ item }) => ({
      symbol: item.symbol,
      name: item.name,
      exchange: null,
      type: item.type,
    })),
  };
}

export async function fetchMovers(limit = 5) {
  const data = await loadJSON("movers.json");
  return {
    ...data,
    gainers: data.gainers.slice(0, limit),
    losers: data.losers.slice(0, limit),
  };
}

export async function fetchNews(scope = "market", limit = 8) {
  if (scope && scope !== "market") {
    try {
      const items = await loadJSON(`news/${slug(scope)}.json`);
      return { ...items, items: items.items.slice(0, limit) };
    } catch {
      // fall through to the market-wide feed
    }
  }
  const market = await loadJSON("news-market.json");
  return { ...market, items: market.items.slice(0, limit) };
}

export async function fetchScreener(params = {}) {
  const data = await loadJSON("screener.json");
  return screen(data.results, params, data.as_of);
}

export async function fetchBacktest(params) {
  return runBacktest(params);
}

export { addHolding, deleteHolding, fetchPortfolio, updateHolding, round2 };
