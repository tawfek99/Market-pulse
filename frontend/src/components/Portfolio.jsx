import { useEffect, useMemo, useRef, useState } from "react";
import {
  addHolding,
  deleteHolding,
  fetchPortfolio,
  searchTickers,
  updateHolding,
} from "../api";
import useFetch from "../hooks/useFetch";
import StepperInput from "./StepperInput";
import { formatLarge, formatPrice } from "../utils";

const PALETTE = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-6)", "var(--cat-7)", "var(--cat-8)"];

function Pnl({ value, pct }) {
  const cls = value == null ? "" : value >= 0 ? "up" : "down";
  const sign = value > 0 ? "+" : "";
  return (
    <span className={cls}>
      {value == null ? "—" : `${sign}${formatPrice(value)} (${sign}${formatPrice(pct)}%)`}
    </span>
  );
}

export default function Portfolio({ refreshKey, onSelect }) {
  const portfolio = useFetch(fetchPortfolio, [refreshKey]);

  // Add form state
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [shares, setShares] = useState("");
  const [cost, setCost] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  // Autocomplete state
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const wrapRef = useRef(null);

  // Row editing state
  const [editingId, setEditingId] = useState(null);
  const [editShares, setEditShares] = useState("");
  const [editCost, setEditCost] = useState("");

  useEffect(() => {
    if (!symbol.trim() || name) {
      setResults([]);
      setOpen(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchTickers(symbol, 6);
        setResults((res.results || []).filter((r) => !r.symbol.includes("=")));
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [symbol, name]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const resetForm = () => {
    setSymbol("");
    setName("");
    setShares("");
    setCost("");
    setFormError("");
    setResults([]);
    setOpen(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    const qty = parseFloat(shares);
    const basis = parseFloat(cost);
    if (!symbol.trim()) return setFormError("Pick a ticker first.");
    if (!Number.isFinite(qty) || qty <= 0) return setFormError("Shares must be a positive number.");
    if (!Number.isFinite(basis) || basis < 0) return setFormError("Average cost must be 0 or more.");

    setBusy(true);
    setFormError("");
    try {
      await addHolding({ symbol: symbol.trim().toUpperCase(), name, shares: qty, cost_basis: basis });
      resetForm();
      portfolio.reload();
    } catch (err) {
      setFormError(err?.message || "Could not add holding.");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (id) => {
    const sharesVal = parseFloat(editShares);
    const costVal = parseFloat(editCost);
    if (!Number.isFinite(sharesVal) || sharesVal <= 0) return;
    if (!Number.isFinite(costVal) || costVal < 0) return;

    try {
      await updateHolding(id, { shares: sharesVal, cost_basis: costVal });
      setEditingId(null);
      portfolio.reload();
    } catch (err) {
      setFormError(err?.message || "Could not update holding.");
    }
  };

  const remove = async (h) => {
    if (!window.confirm(`Remove ${h.symbol} from your portfolio?`)) return;
    try {
      await deleteHolding(h.id);
      portfolio.reload();
    } catch (err) {
      setFormError(err?.message || "Could not remove holding.");
    }
  };

  const data = portfolio.data;
  const holdings = data?.holdings || [];
  const total = data?.total_value;

  // Client-side sorting of the holdings table.
  const [sort, setSort] = useState({ key: null, dir: "desc" });
  const toggleSort = (key) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }
    );
  const sorted = useMemo(() => {
    if (!sort.key) return holdings;
    const k = sort.key;
    return [...holdings].sort((a, b) => {
      const av = a[k];
      const bv = b[k];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * (sort.dir === "asc" ? 1 : -1);
    });
  }, [holdings, sort]);

  const sortHeader = (key, label) => (
    <button className={`th-sort ${sort.key === key ? "active" : ""}`} onClick={() => toggleSort(key)}>
      {label} {sort.key === key ? (sort.dir === "asc" ? "↑" : "↓") : ""}
    </button>
  );

  return (
    <div className="portfolio">
      {/* Add form */}
      <form className="pf-add" onSubmit={submit}>
        <div className="pf-symbol-wrap" ref={wrapRef}>
          <input
            className="pf-input pf-symbol"
            type="text"
            placeholder={name || "Ticker (e.g. AAPL)"}
            value={symbol}
            onChange={(e) => {
              setName("");
              setSymbol(e.target.value);
            }}
            aria-label="Ticker to add"
          />
          {searching && <span className="search-spinner" />}
          {open && results.length > 0 && (
            <ul className="pf-dropdown">
              {results.map((r) => (
                <li key={r.symbol}>
                  <button
                    type="button"
                    className="pf-dropdown-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSymbol(r.symbol);
                      setName(r.name || r.symbol);
                      setOpen(false);
                    }}
                  >
                    <span className="sr-symbol">{r.symbol}</span>
                    <span className="sr-name">{r.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <StepperInput
          className="pf-qty"
          value={shares}
          onChange={setShares}
          placeholder="Shares"
          min={0}
          ariaLabel="Shares"
        />
        <StepperInput
          className="pf-qty"
          value={cost}
          onChange={setCost}
          placeholder="Avg cost"
          min={0}
          ariaLabel="Average cost per share"
        />
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Adding…" : "+ Add"}
        </button>
      </form>
      {formError && <p className="pf-error">{formError}</p>}

      {/* Holdings table */}
      {portfolio.loading && !data && <div className="muted pf-hint">Loading portfolio…</div>}
      {portfolio.error && <p className="pf-error">{portfolio.error}</p>}

      {data && holdings.length === 0 && (
        <div className="muted pf-hint">
          Your portfolio is empty — add your first holding above. P&L is computed
          live against current prices.
        </div>
      )}

      {holdings.length > 0 && (
        <>
          <div className="pf-table-wrap">
            <table className="pf-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th className="num">Shares</th>
                  <th className="num">Avg cost</th>
                  <th className="num">Price</th>
                  <th className="num">{sortHeader("value", "Value")}</th>
                  <th className="num">{sortHeader("pnl", "P&L")}</th>
                  <th className="num">{sortHeader("day_change_pct", "Day")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((h) =>
                  editingId === h.id ? (
                    <tr key={h.id} className="pf-row-editing">
                      <td>
                        <strong>{h.symbol}</strong>
                      </td>
                      <td className="num">
                        <StepperInput
                          className="pf-edit"
                          value={editShares}
                          onChange={setEditShares}
                          min={0}
                          ariaLabel="Shares"
                        />
                      </td>
                      <td className="num">
                        <StepperInput
                          className="pf-edit"
                          value={editCost}
                          onChange={setEditCost}
                          min={0}
                          ariaLabel="Average cost per share"
                        />
                      </td>
                      <td className="num">{formatPrice(h.price)}</td>
                      <td className="num">{formatLarge(h.value)}</td>
                      <td className="num">
                        <Pnl value={h.pnl} pct={h.pnl_pct} />
                      </td>
                      <td className={`num ${h.day_change_pct == null ? "" : h.day_change_pct >= 0 ? "up" : "down"}`}>
                        {h.day_change_pct == null ? "—" : `${h.day_change_pct >= 0 ? "+" : ""}${formatPrice(h.day_change_pct)}%`}
                      </td>
                      <td className="pf-actions">
                        <button className="pf-icon-btn" onClick={() => saveEdit(h.id)} title="Save">
                          ✓
                        </button>
                        <button className="pf-icon-btn" onClick={() => setEditingId(null)} title="Cancel">
                          ✕
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={h.id}>
                      <td>
                        <button className="pf-link" onClick={() => onSelect(h.symbol)} title={h.name || h.symbol}>
                          {h.symbol}
                        </button>
                      </td>
                      <td className="num">{formatPrice(h.shares)}</td>
                      <td className="num">{formatPrice(h.cost_basis)}</td>
                      <td className="num">{formatPrice(h.price)}</td>
                      <td className="num">{formatLarge(h.value)}</td>
                      <td className="num">
                        <Pnl value={h.pnl} pct={h.pnl_pct} />
                      </td>
                      <td className={`num ${h.day_change_pct == null ? "" : h.day_change_pct >= 0 ? "up" : "down"}`}>
                        {h.day_change_pct == null ? "—" : `${h.day_change_pct >= 0 ? "+" : ""}${formatPrice(h.day_change_pct)}%`}
                      </td>
                      <td className="pf-actions">
                        <button
                          className="pf-icon-btn"
                          title="Edit"
                          onClick={() => {
                            setEditingId(h.id);
                            setEditShares(String(h.shares));
                            setEditCost(String(h.cost_basis));
                          }}
                        >
                          ✎
                        </button>
                        <button className="pf-icon-btn pf-danger" title="Remove" onClick={() => remove(h)}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="pf-totals">
            <span>Total value <strong>{formatLarge(data.total_value)}</strong></span>
            <span>Total cost <strong>{formatLarge(data.total_cost)}</strong></span>
            <span>
              Total P&L{" "}
              <Pnl value={data.total_pnl} pct={data.total_pnl_pct} />
            </span>
          </div>

          {/* Allocation */}
          {total > 0 && (
            <div className="pf-alloc">
              <div className="pf-alloc-bar">
                {sorted.map((h, i) =>
                  h.value > 0 ? (
                    <span
                      key={h.symbol}
                      style={{
                        width: `${(h.value / total) * 100}%`,
                        background: PALETTE[i % PALETTE.length],
                      }}
                      title={`${h.symbol} — ${((h.value / total) * 100).toFixed(1)}%`}
                    />
                  ) : null
                )}
              </div>
              <div className="pf-alloc-legend">
                {sorted.map((h, i) => (
                  <span key={h.symbol} className="pf-alloc-item">
                    <span className="pf-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                    {h.symbol} {total ? ((h.value / total) * 100).toFixed(1) : "0.0"}%
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
