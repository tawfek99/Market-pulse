import SearchBar from "./SearchBar";
import { IS_DEMO } from "../api";
import { MoonIcon, PulseMark, RefreshIcon, SunIcon } from "./Icons";

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "screener", label: "Screener" },
  { id: "portfolio", label: "Portfolio" },
  { id: "backtest", label: "Backtest" },
];

export default function Header({ page, onNavigate, onSelectTicker, theme, onToggleTheme, onRefresh }) {
  return (
    <header className="header">
      <div className="container header-inner">
        <div className="brand">
          <span className="brand-mark">
            <PulseMark />
          </span>
          <div>
            <h1 className="brand-title">Market Pulse</h1>
            <p className="tagline">Stock sentiment & market intelligence</p>
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
          <SearchBar onSelect={onSelectTicker} />
          <button
            className="btn btn-icon"
            onClick={onToggleTheme}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            aria-label="Toggle color theme"
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          <button className="btn" onClick={onRefresh} title="Refresh all data">
            <RefreshIcon /> Refresh
          </button>
        </div>
      </div>
    </header>
  );
}
