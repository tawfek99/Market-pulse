// Single entry point for all data access. Picks one of two implementations:
//
//   - `VITE_DEMO=1`              -> self-contained demo (frozen snapshot)
//   - `VITE_API_URL` set (prod)  -> live FastAPI backend
//   - otherwise (dev)            -> live backend via the Vite `/api` proxy
//
// A production build with neither flag falls back to the demo so the GitHub
// Pages site always works. The chosen module is imported lazily, so only its
// code ships in (and loads with) the build.
const DEMO =
  import.meta.env.VITE_DEMO === "1" ||
  (!import.meta.env.VITE_API_URL && import.meta.env.PROD);

export const IS_DEMO = DEMO;

let implPromise;
const impl = () =>
  (implPromise ??= DEMO ? import("./api/demo") : import("./api/live"));

const call = (name) => (...args) => impl().then((mod) => mod[name](...args));

export const fetchSentiment = call("fetchSentiment");
export const fetchHistory = call("fetchHistory");
export const fetchMarketSummary = call("fetchMarketSummary");
export const fetchChart = call("fetchChart");
export const searchTickers = call("searchTickers");
export const fetchTicker = call("fetchTicker");
export const fetchMovers = call("fetchMovers");
export const fetchPortfolio = call("fetchPortfolio");
export const addHolding = call("addHolding");
export const updateHolding = call("updateHolding");
export const deleteHolding = call("deleteHolding");
export const fetchScreener = call("fetchScreener");
export const fetchNews = call("fetchNews");
export const fetchBacktest = call("fetchBacktest");
