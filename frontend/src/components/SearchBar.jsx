import { useEffect, useRef, useState } from "react";
import { searchTickers } from "../api";
import { SearchIcon } from "./Icons";

/**
 * Ticker autocomplete. When `collapsed` is set (the phone header while
 * scrolled), it renders as an icon button that expands into a full-width
 * overlay field, so the slim header still has search.
 */
export default function SearchBar({ onSelect, collapsed = false }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const showInput = !collapsed || expanded;

  // Debounced autocomplete
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchTickers(query, 8);
        setResults(res.results || []);
        setOpen(true);
        setActive(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Close when clicking outside (and collapse the overlay field on phones).
  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        if (collapsed) setExpanded(false);
      }
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [collapsed]);

  useEffect(() => {
    if (collapsed && expanded) inputRef.current?.focus();
  }, [collapsed, expanded]);

  const choose = (symbol) => {
    onSelect(symbol);
    setQuery("");
    setOpen(false);
    if (collapsed) setExpanded(false);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && (!open || !results.length) && query.trim()) {
      choose(query.trim().toUpperCase());
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      choose(results[active].symbol);
    } else if (e.key === "Escape") {
      setOpen(false);
      if (collapsed) setExpanded(false);
    }
  };

  if (!showInput) {
    return (
      <button
        type="button"
        className="btn btn-icon search-toggle"
        aria-label="Search tickers"
        title="Search tickers"
        onClick={() => setExpanded(true)}
      >
        <SearchIcon />
      </button>
    );
  }

  return (
    <div className={`search${collapsed ? " search--overlay" : ""}`} ref={wrapRef}>
      <div className="search-input-wrap">
        <span className="search-icon" aria-hidden>
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          className="search-input"
          type="text"
          placeholder="Search ticker… e.g. AAPL"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => results.length && setOpen(true)}
          aria-label="Search tickers"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          enterKeyHint="search"
        />
        {loading && <span className="search-spinner" />}
      </div>

      {open && results.length > 0 && (
        <ul className="search-results">
          {results.map((r, i) => (
            <li key={r.symbol}>
              <button
                type="button"
                className={`search-result ${i === active ? "active" : ""}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  choose(r.symbol);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span className="sr-symbol">{r.symbol}</span>
                <span className="sr-name">{r.name}</span>
                <span className="sr-type">{r.type}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
