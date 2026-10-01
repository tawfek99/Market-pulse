# Market Pulse — project instructions

Full-stack market sentiment dashboard (FastAPI + React/Vite + yfinance).
Read `CHANGELOG.md` for the complete history of what has been built, and
`README.md` for the user-facing overview.

## Run the app

```bash
# Backend (port 8000) — Python 3.11, run from backend/
python -m uvicorn app.main:app --port 8000 --log-level warning

# Frontend (port 5173) — run from frontend/
npm run dev
```

The Vite dev server proxies `/api` to the backend. Always verify backend
changes by restarting uvicorn (no --reload is used) and hitting the endpoint.
Verify frontend changes with `npm run build` (no ESLint gate; the build is the
check).

## Architecture

- **Backend** (`backend/app/`): `main.py` (routes + validation), `data.py`
  (yfinance wrapper + in-memory TTL cache — reuse its caching), `config.py`
  (tickers/weights/thresholds), `indicators.py`, `sentiment.py` (rule-based
  composite), `news.py` (VADER headline sentiment + finance lexicon),
  `tickers.py`, `screener.py`, `backtest.py`, `db.py` (stdlib sqlite3,
  `backend/market_pulse.db`), `schemas.py` (Pydantic models).
- **Frontend** (`frontend/src/`): `App.jsx` owns hash routing (`#/overview`,
  `#/screener`, `#/portfolio`, `#/backtest`, `#/ticker/SYMBOL`), theme,
  watchlist, refreshKey. Pages are lazy-loaded in `pages/`. Shared UI in
  `components/`.
- **Data flow**: `hooks/useFetch.js` (loading/error/reload; deps array is
  respected). `api.js` is the only HTTP layer.
- **Chart periods**: 1d/5d/1mo/6mo/ytd/1y/5y/max (+2y/3mo/10y server-side);
  intraday intervals 5m/15m/60m for the short windows.
- Sentiment/backtest endpoints use `VALID_PERIODS`; chart/ticker endpoints use
  `CHART_PERIODS` + `CHART_INTERVALS` (both in `main.py`).

## Conventions

- Theming: colors only via CSS variables in `styles.css` (`:root` = dark,
  `:root[data-theme="light"]` = light). SVG charts use inline
  `style={{ stroke: "var(--…)" }}` — never hardcoded hex.
- No `type="number"` inputs — use `components/StepperInput.jsx`.
- Number formatting via `utils.js` helpers (`formatPrice`, `formatLarge`,
  `timeAgo`).
- Rule-based, transparent logic everywhere; no ML. Every score must trace back
  to a visible input. Include disclaimers ("not financial advice") on
  analytical features.
- Endpoints return clean HTTP errors (422 invalid args, 404 missing data,
  502 upstream failures, 409 duplicate portfolio symbol).
- The model cannot view images in this environment — verify visual changes via
  build + API tests and ask the user for a description if something looks off.

## Verification checklist after changes

1. Restart backend; smoke-test affected endpoints (PowerShell:
   `Invoke-RestMethod http://localhost:8000/<path>`).
2. `npm run build` in `frontend/` must pass.
3. Keep the main bundle split: new pages are added via `React.lazy` in
   `App.jsx`, never imported eagerly.
