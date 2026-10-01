import { lazy, Suspense, useEffect, useState } from "react";
import Header from "./components/Header";
import ErrorBoundary from "./components/ErrorBoundary";
import Skeleton from "./components/Skeleton";

// Page-level code splitting keeps the initial bundle small; each page (and
// its charting deps) loads on demand.
const OverviewPage = lazy(() => import("./pages/OverviewPage"));
const ScreenerPage = lazy(() => import("./pages/ScreenerPage"));
const PortfolioPage = lazy(() => import("./pages/PortfolioPage"));
const BacktestPage = lazy(() => import("./pages/BacktestPage"));
const TickerPage = lazy(() => import("./pages/TickerPage"));

const WATCHLIST_KEY = "mp-watchlist";
const THEME_KEY = "mp-theme";
const PAGES = ["overview", "screener", "portfolio", "backtest"];

function routeFromHash() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [first, second] = hash.split("/");
  if (first === "ticker" && second) {
    return { type: "ticker", symbol: decodeURIComponent(second) };
  }
  return { type: "page", id: PAGES.includes(first) ? first : "overview" };
}

export default function App() {
  const [route, setRoute] = useState(routeFromHash);
  const [refreshKey, setRefreshKey] = useState(0);

  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) || "dark";
    } catch {
      return "dark";
    }
  });

  const [watchlist, setWatchlist] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(WATCHLIST_KEY) || "[]");
    } catch {
      return [];
    }
  });

  // Hash-based routing so pages are deep-linkable and back-button friendly.
  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    // Keep the browser chrome (mobile address bar) in step with the theme.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#090a0d" : "#f5f6f8");
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // storage may be unavailable (private mode) — theme still applies
    }
  }, [theme]);

  const openTicker = (symbol) => {
    window.location.hash = `/ticker/${encodeURIComponent(symbol)}`;
  };

  const togglePin = (symbol, name) => {
    setWatchlist((prev) => {
      const exists = prev.some((w) => w.symbol === symbol);
      if (exists) return prev.filter((w) => w.symbol !== symbol);
      return [...prev, { symbol, name: name || symbol }];
    });
  };

  const removeFromWatchlist = (symbol) =>
    setWatchlist((prev) => prev.filter((w) => w.symbol !== symbol));

  const pageId = route.type === "page" ? route.id : null;
  const tickerSymbol = route.type === "ticker" ? route.symbol : null;
  // The ticker detail page gives the price chart more horizontal room.
  const wide = route.type === "ticker";
  const isPinned =
    tickerSymbol && watchlist.some((w) => w.symbol === tickerSymbol);

  return (
    <div className={`app${wide ? " app--wide" : ""}`}>
      <Header
        page={pageId}
        onNavigate={(p) => {
          window.location.hash = `/${p}`;
        }}
        onSelectTicker={openTicker}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        onRefresh={() => setRefreshKey((k) => k + 1)}
      />

      {/* Keying on the route resets scroll + refetches on navigation; refresh
          re-runs fetches via `refreshKey` without remounting (state kept). */}
      <main className="container" key={route.type === "ticker" ? `ticker-${route.symbol}` : route.id}>
        <Suspense fallback={<Skeleton height={640} />}>
          <ErrorBoundary>
            {route.type === "ticker" && (
              <TickerPage
                symbol={route.symbol}
                refreshKey={refreshKey}
                onTogglePin={togglePin}
                isPinned={isPinned}
              />
            )}
            {route.id === "overview" && (
              <OverviewPage
                refreshKey={refreshKey}
                onSelect={openTicker}
                watchlist={watchlist}
                onTogglePin={togglePin}
                onRemoveWatchlist={removeFromWatchlist}
              />
            )}
            {route.id === "screener" && (
              <ScreenerPage refreshKey={refreshKey} onSelect={openTicker} />
            )}
            {route.id === "portfolio" && (
              <PortfolioPage refreshKey={refreshKey} onSelect={openTicker} />
            )}
            {route.id === "backtest" && (
              <BacktestPage refreshKey={refreshKey} onSelect={openTicker} />
            )}
          </ErrorBoundary>
        </Suspense>
      </main>

      <footer className="footer">
        <div className="container">
          <p>
            Market Pulse — rule-based sentiment scoring, headline sentiment
            (VADER), a technical screener, and SMA-crossover backtesting.
            Signals are derived from public market data for educational
            purposes only; not financial advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
