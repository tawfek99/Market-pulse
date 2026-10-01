// Minimal technical indicators for the client-side backtest. Ports the math
// in `backend/app/indicators.py` so the demo matches the live API.

/** Simple moving average; leading window-1 entries are null. */
export function sma(values, window) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    if (i >= window - 1) out[i] = sum / window;
  }
  return out;
}

/** Simple daily percentage returns; the first entry is 0. */
export function dailyReturns(closes) {
  const out = new Array(closes.length).fill(0);
  for (let i = 1; i < closes.length; i += 1) {
    out[i] = closes[i] / closes[i - 1] - 1;
  }
  return out;
}

export function mean(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Sample standard deviation (ddof = 1), matching pandas' default. */
export function sampleStd(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance =
    values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}
