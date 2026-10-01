// Client-side SMA-crossover backtest. Ports `backend/app/backtest.py` so the
// demo reproduces the live results from the bundled daily close series.
import { dailyReturns, mean, sampleStd, sma } from "./indicators.js";
import { loadJSON, round2, slug, sliceByPeriod } from "./load.js";

const DAY_MS = 86400000;

function cumprod(returns, start) {
  const equity = new Array(returns.length);
  let value = start;
  for (let i = 0; i < returns.length; i += 1) {
    value *= 1 + returns[i];
    equity[i] = value;
  }
  return equity;
}

function metrics(equity, returns) {
  const total = (equity[equity.length - 1] / equity[0] - 1) * 100;
  const years = Math.max(equity.length, 1) / 252;
  const cagr = ((equity[equity.length - 1] / equity[0]) ** (1 / years) - 1) * 100;

  let peak = -Infinity;
  let drawdown = 0;
  for (const value of equity) {
    peak = Math.max(peak, value);
    drawdown = Math.min(drawdown, value / peak - 1);
  }

  const std = sampleStd(returns);
  const sharpe = std > 0 ? (mean(returns) / std) * Math.sqrt(252) : null;

  return {
    total_return_pct: round2(total),
    cagr_pct: round2(cagr),
    max_drawdown_pct: round2(drawdown * 100),
    sharpe: round2(sharpe),
    volatility_pct: round2(std * Math.sqrt(252) * 100),
  };
}

export async function runBacktest({ ticker, fast, slow, period }) {
  const symbol = String(ticker).toUpperCase().trim();
  const f = Number(fast);
  const s = Number(slow);

  if (!(f >= 2) || !(s >= 2)) throw new Error("MA windows must be at least 2.");
  if (f >= s) throw new Error("The fast window must be smaller than the slow window.");

  let chart;
  try {
    chart = await loadJSON(`charts/${slug(symbol)}.json`);
  } catch {
    throw new Error(`No demo data for '${symbol}'.`);
  }

  const rows = sliceByPeriod(chart.daily.points, period);
  const dates = rows.map((r) => r[0]);
  const closes = rows.map((r) => r[4]);

  if (!closes.length) throw new Error(`No data available for '${symbol}'.`);
  if (closes.length < s + 5) {
    throw new Error(`Not enough history for a ${s}-day window on '${symbol}'.`);
  }

  const fastMA = sma(closes, f);
  const slowMA = sma(closes, s);
  const signal = closes.map((_, i) =>
    fastMA[i] !== null && slowMA[i] !== null && fastMA[i] > slowMA[i] ? 1 : 0
  );
  const position = signal.map((_, i) => (i === 0 ? 0 : signal[i - 1]));

  const daily = dailyReturns(closes);
  const stratReturns = position.map((p, i) => p * daily[i]);
  const stratEquity = cumprod(stratReturns, 100);
  const buyHoldEquity = cumprod(daily, 100);

  // Trade ledger: one trade per 0 -> 1 -> 0 position flip.
  const trades = [];
  let entryIndex = null;
  let prev = 0;
  for (let i = 0; i < position.length; i += 1) {
    const pos = position[i];
    if (pos > prev && prev === 0) {
      entryIndex = i;
    } else if (pos < prev && prev > 0 && entryIndex !== null) {
      trades.push(makeTrade(dates, closes, entryIndex, i, true));
      entryIndex = null;
    }
    prev = pos;
  }
  if (entryIndex !== null) {
    trades.push(makeTrade(dates, closes, entryIndex, closes.length - 1, false));
  }

  const wins = trades.filter((t) => t.return_pct > 0).length;
  const winRate = trades.length ? (wins / trades.length) * 100 : null;

  const equity = dates.map((date, i) => ({
    date: date.slice(0, 10),
    strategy: round2(stratEquity[i]),
    buy_hold: round2(buyHoldEquity[i]),
  }));

  return {
    ticker: symbol,
    period,
    fast: f,
    slow: s,
    as_of: dates[dates.length - 1],
    metrics: {
      strategy: {
        ...metrics(stratEquity, stratReturns),
        trades_count: trades.length,
        win_rate_pct: round2(winRate),
      },
      buy_hold: metrics(buyHoldEquity, daily),
    },
    equity,
    trades,
  };
}

function makeTrade(dates, closes, entryIndex, exitIndex, closed) {
  const entryPrice = closes[entryIndex];
  const exitPrice = closes[exitIndex];
  const entryDate = new Date(dates[entryIndex]);
  const exitDate = new Date(dates[exitIndex]);
  return {
    entry_date: dates[entryIndex].slice(0, 10),
    exit_date: closed ? dates[exitIndex].slice(0, 10) : null,
    entry_price: round2(entryPrice),
    exit_price: closed ? round2(exitPrice) : null,
    return_pct: round2((exitPrice / entryPrice - 1) * 100),
    days: Math.round((exitDate - entryDate) / DAY_MS),
  };
}
