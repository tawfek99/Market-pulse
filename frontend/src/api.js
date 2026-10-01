// Thin API client. In dev, Vite proxies `/api` to the FastAPI backend.
// In production (e.g. GitHub Pages), `VITE_API_URL` points at the deployed
// FastAPI origin; a trailing slash is stripped so `${BASE}${path}` stays clean.
const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body.detail ? `: ${body.detail}` : "";
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(`Request failed (${res.status})${detail}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

const json = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const fetchSentiment = (period = "1y") =>
  request(`/api/sentiment?period=${period}`);

export const fetchHistory = (period = "1y") =>
  request(`/api/sentiment/history?period=${period}`);

export const fetchMarketSummary = () => request("/api/market/summary");

export const fetchChart = (ticker, period = "6mo", interval = "1d") =>
  request(
    `/api/market/chart?ticker=${encodeURIComponent(ticker)}&period=${period}&interval=${interval}`
  );

export const searchTickers = (q, limit = 8) =>
  request(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`);

export const fetchTicker = (ticker, period = "1y", interval = "1d") =>
  request(
    `/api/ticker/${encodeURIComponent(ticker)}?period=${period}&interval=${interval}`
  );

export const fetchMovers = (limit = 5) =>
  request(`/api/market/movers?limit=${limit}`);

// ---------- Portfolio ----------

export const fetchPortfolio = () => request("/api/portfolio");

export const addHolding = (holding) =>
  request("/api/portfolio", json("POST", holding));

export const updateHolding = (id, patch) =>
  request(`/api/portfolio/${id}`, json("PUT", patch));

export const deleteHolding = (id) =>
  request(`/api/portfolio/${id}`, { method: "DELETE" });

// ---------- Screener ----------

export const fetchScreener = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") qs.set(key, value);
  });
  return request(`/api/screener?${qs.toString()}`);
};

// ---------- News sentiment ----------

export const fetchNews = (scope = "market", limit = 8) =>
  request(`/api/news/${encodeURIComponent(scope)}?limit=${limit}`);

// ---------- Backtest ----------

export const fetchBacktest = (params) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") qs.set(key, value);
  });
  return request(`/api/backtest?${qs.toString()}`);
};
