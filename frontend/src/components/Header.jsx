import { useEffect, useState } from "react";
import SearchBar from "./SearchBar";
import { IS_DEMO } from "../api";
import { MoonIcon, PulseMark, RefreshIcon, SunIcon } from "./Icons";
import useMediaQuery from "../hooks/useMediaQuery";

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "screener", label: "Screener" },
  { id: "portfolio", label: "Portfolio" },
  { id: "backtest", label: "Backtest" },
];

export default function Header({ page, onNavigate, onSelectTicker, theme, onToggleTheme, onRefresh }) {
  const isNarrow = useMediaQuery("(max-width: 640px)");
  const [condensed, setCondensed] = useState(false);

  // On phones the header collapses to a single slim row once the page is
  // scrolled, and expands again at the top. Separate thresholds give a little
  // hysteresis so it doesn't flicker right at the boundary.
  useEffect(() => {
    if (!isNarrow) {
      setCondensed(false);
      return undefined;
    }
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        setCondensed((prev) => (prev ? y > 12 : y > 44));
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isNarrow]);

  return (
    <header className={`header${condensed ? " header--condensed" : ""}`}>
      <div className="container header-inner">
        <div className="brand">
          <span className="brand-mark">
            <PulseMark />
          </span>
          <div className="brand-text">
            <h1 className="brand-title">Market Pulse</h1>
            <p className="tagline">Stock sentiment &amp; market intelligence</p>
          </div>
        </div>

        <nav className="nav" aria-label="Primary">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#/${n.id}`}
              className={`nav-link ${page === n.id ? "active" : ""}`}
              onClick={() => onNavigate(n.id)}
              aria-current={page === n.id ? "page" : undefined}
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="header-right">
          <span
            className={`live-badge${IS_DEMO ? " is-demo" : ""}`}
            title={IS_DEMO ? "Demo build — frozen data snapshot, not live" : "Live market data"}
          >
            <span className="live-dot" />
            {IS_DEMO ? "Demo" : "Live"}
          </span>
          <SearchBar onSelect={onSelectTicker} collapsed={isNarrow && condensed} />
          <button
            className="btn btn-icon"
            onClick={onToggleTheme}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            aria-label="Toggle color theme"
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          <button className="btn" onClick={onRefresh} title="Refresh all data">
            <RefreshIcon /> <span className="btn-label">Refresh</span>
          </button>
        </div>
      </div>
    </header>
  );
}
