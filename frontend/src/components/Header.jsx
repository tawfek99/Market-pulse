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

  // On phones the header condenses once the page is scrolled down and expands
  // again when the user scrolls up. It is direction-based (not tied to an
  // absolute offset) with a small deadband, so the header's own height change
  // can't feed back into the scroll position and flicker.
  useEffect(() => {
    if (!isNarrow) {
      setCondensed(false);
      return undefined;
    }
    let lastY = Math.max(0, window.scrollY);
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = Math.max(0, window.scrollY);
        const dy = y - lastY;
        // Ignore tiny jitter (the mobile URL bar resize fires scroll events).
        if (Math.abs(dy) > 6) {
          if (y <= 8) {
            setCondensed(false);
          } else if (dy > 0 && y > 64) {
            setCondensed(true); // scrolling down
          } else if (dy < 0) {
            setCondensed(false); // scrolling up reveals the full header
          }
          lastY = y;
        }
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
          <SearchBar onSelect={onSelectTicker} collapsed={isNarrow} />
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
