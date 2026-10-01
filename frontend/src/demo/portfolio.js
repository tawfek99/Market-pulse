// localStorage-backed portfolio for the demo build. The live app persists
// holdings in SQLite on the server; here each visitor gets their own browser
// store, so add / edit / remove genuinely work and survive reloads.
import { loadJSON, round2, slug } from "./load.js";

const KEY = "mp-demo-portfolio";

function read() {
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function write(rows) {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows));
  } catch {
    // storage may be unavailable (private mode) — the session still works in memory
  }
}

async function quote(symbol) {
  try {
    const detail = await loadJSON(`tickers/${slug(symbol)}.json`);
    return {
      price: detail.info.price,
      day_change_pct: detail.info.change_pct,
      name: detail.info.name,
    };
  } catch {
    return {};
  }
}

async function enrich(rows) {
  const out = [];
  for (const holding of rows) {
    const q = await quote(holding.symbol);
    const price = q.price ?? null;
    const value = price !== null ? price * holding.shares : null;
    const costValue = holding.cost_basis * holding.shares;
    const pnl = value !== null ? value - costValue : null;
    const pnlPct = pnl !== null && costValue ? (pnl / costValue) * 100 : null;
    out.push({
      id: holding.id,
      symbol: holding.symbol,
      name: holding.name || q.name || holding.symbol,
      shares: holding.shares,
      cost_basis: holding.cost_basis,
      price: round2(price),
      value: round2(value),
      cost_value: round2(costValue),
      pnl: round2(pnl),
      pnl_pct: round2(pnlPct),
      day_change_pct: round2(q.day_change_pct),
      added_at: holding.added_at,
    });
  }
  return out;
}

export async function fetchPortfolio() {
  const rows = await enrich(read());
  const values = rows.map((r) => r.value).filter((v) => v !== null);
  const costs = rows.map((r) => r.cost_value).filter((v) => v !== null);
  const totalValue = values.length ? values.reduce((a, b) => a + b, 0) : null;
  const totalCost = costs.length ? costs.reduce((a, b) => a + b, 0) : null;
  const totalPnl = totalValue !== null && totalCost !== null ? totalValue - totalCost : null;
  const totalPnlPct = totalPnl !== null && totalCost ? (totalPnl / totalCost) * 100 : null;

  return {
    as_of: null,
    holdings: rows,
    total_value: round2(totalValue),
    total_cost: round2(totalCost),
    total_pnl: round2(totalPnl),
    total_pnl_pct: round2(totalPnlPct),
  };
}

export async function addHolding({ symbol, name, shares, cost_basis }) {
  const rows = read();
  const sym = String(symbol).toUpperCase().trim();
  if (rows.some((r) => r.symbol === sym)) {
    throw new Error(`${sym} is already in the portfolio.`);
  }
  const q = await quote(sym);
  const id = rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;
  const row = {
    id,
    symbol: sym,
    name: name || q.name || sym,
    shares: Number(shares),
    cost_basis: Number(cost_basis),
    added_at: new Date().toISOString(),
  };
  rows.push(row);
  write(rows);
  const [enriched] = await enrich([row]);
  return enriched;
}

export async function updateHolding(id, patch) {
  const rows = read();
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error("Holding not found.");
  if (patch.shares !== undefined && patch.shares !== null) row.shares = Number(patch.shares);
  if (patch.cost_basis !== undefined && patch.cost_basis !== null) {
    row.cost_basis = Number(patch.cost_basis);
  }
  write(rows);
  const [enriched] = await enrich([row]);
  return enriched;
}

export async function deleteHolding(id) {
  write(read().filter((r) => r.id !== id));
  return null;
}
