# Changelog — Market Pulse

Everything built, changed, and fixed across development sessions, in order.
Also see `AGENTS.md` for project conventions and `README.md` for the overview.

---

## Round 1 — Portfolio tracker & stock screener

### Portfolio tracker (SQLite)
- **Backend**
  - `app/db.py` — stdlib `sqlite3` store (`backend/market_pulse.db`, created at
    runtime, gitignored). Table `holdings` (id, symbol UNIQUE, name, shares,
    cost_basis, added_at). Functions: `list_holdings`, `add_holding`,
    `update_holding`, `get_holding`, `delete_holding`.
  - Endpoints: `GET /api/portfolio` (holdings enriched with live price, value,
    P&L, P&L %, day change + totals), `POST /api/portfolio` (409 on duplicate
    symbol), `PUT /api/portfolio/{id}`, `DELETE /api/portfolio/{id}`.
- **Frontend**
  - `components/Portfolio.jsx` — add form (ticker autocomplete + shares + avg
    cost), holdings table with inline edit, delete with confirm, totals row,
    allocation bar with legend.
  - `api.js` extended to support POST/PUT/DELETE with JSON bodies (204 handling).

### Stock screener
- **Backend**
  - `app/screener.py` — computes per-ticker RSI-14, SMA50/200 position, % from
    52-week high, day change over the 45-name `MOVERS_BASKET` universe from a
    single cached 1y download. Server-side filter + sort + limit.
  - Endpoint: `GET /api/screener` (rsi_min/max, above_sma50/200,
    within_high_pct, change_min/max, sort_by, order, limit).
- **Frontend**
  - `components/Screener.jsx` — preset chips, filter controls, sortable table
    whose rows open the ticker view.

---

## Round 2 — App shell, news sentiment, backtest, overlays

### Interface restructured into a real product
- Hash-routed pages: **Overview / Screener / Portfolio / Backtest**
  (`#/overview`, `#/screener`, …). Back-button friendly, deep-linkable.
- New header: brand, nav tabs, pulsing "Live" badge, search, theme toggle,
  refresh.
- **Light/dark theme** — CSS variables on `:root` / `[data-theme="light"]`,
  persisted in localStorage; charts theme-aware.
- **Skeleton loaders** (`components/Skeleton.jsx`) replaced all spinners.
- `pages/` folder: `OverviewPage`, `ScreenerPage`, `PortfolioPage`,
  `BacktestPage`; shared `components/PageHead.jsx`.

### News sentiment (VADER NLP)
- `app/news.py` — fetches Yahoo Finance headlines (`yf.Ticker().news`,
  nested `content` payload), scores each with VADER, blends into a 0–100 score
  with recency weighting (24h half-life), mapped to Bullish/Neutral/Bearish.
- Endpoints: `GET /api/news/market`, `GET /api/news/{ticker}`.
- `components/NewsSentiment.jsx` — aggregate score + counts + scored headline
  list (links, publisher, time-ago). Used on Overview (market) and ticker view.

### Chart overlays
- `CandlestickChart` gained SMA 20 / SMA 50 / Bollinger(20,2) overlays with
  toggle chips; price domain expands to include visible overlays.

### Strategy backtest
- `app/backtest.py` — SMA-crossover vs buy-and-hold: equity curves (start=100),
  total return, CAGR, max drawdown, Sharpe, annualized volatility, trade ledger
  with win rate. Trades enter/exit on the session after signal flips.
- Endpoint: `GET /api/backtest?ticker&fast&slow&period` (422 on invalid args).
- `pages/BacktestPage.jsx` — form, metrics cards (incl. "+X% vs buy & hold"),
  Recharts equity chart, trade ledger table, disclaimer.

---

## Round 3 — Fixes & polish

- **Bundle size**: pages lazy-loaded (`React.lazy` + Suspense); main bundle
  583 kB → 164 kB, Recharts split into its own on-demand chunk.
- **Refresh no longer remounts pages** — `refreshKey` prop feeds `useFetch`
  deps, so filters/period survive a refresh.
- **Light-theme contrast**: hardcoded dark hover hexes (`#1e2b47`, `#2b3b57`,
  `#062033`) replaced with theme variables (`--surface-hover`,
  `--border-hover`, `--accent-contrast`, `--accent-hover`).
- **Finance lexicon for VADER** (~90 terms: "surges", "sinks", "downgrade",
  "bankruptcy", …) — fixes flat 0.0 scores on financial headlines.
- **Movers strip**: ‹ › arrows, ▲ Gainers / ▼ Losers group labels, snap
  scrolling, edge fade mask, thin themed scrollbars (global).
- **Gauge redesign 1**: needle replaced with dot indicator; score moved below
  the arc (needle had covered the number at ~50).
- **Ticker modal enlarged** 760 → 1080 px with two-column layout.

---

## Round 4 — Gauge completely replaced

- `SentimentGauge` rewritten as a **linear sentiment meter** (Fear & Greed
  style): red→amber→green gradient scale, marker line, colored score pill
  (clamped to track ends), muted zone labels, category caption. No needle,
  nothing overlaps the number.

---

## Round 5 — Custom stepper inputs

- Native `type="number"` spinner buttons turned white on click (OS styling).
  Removed globally (CSS) and replaced with `components/StepperInput.jsx`:
  themed − / + buttons (accent on press), arrow-key stepping, min/max clamping.
- Applied to Portfolio (shares, avg cost — add & edit), Screener (RSI,
  % from high), Backtest (fast/slow MA).

---

## Round 6 — Ticker page, zoom, more periods & filters

### Dedicated ticker page
- Ticker detail moved from modal to a page: `#/ticker/AAPL` (deep-linkable).
  `pages/TickerPage.jsx` replaces `components/TickerModal.jsx` (deleted).
  All entry points (search, movers, watchlist, screener, portfolio, backtest)
  navigate there. Quote/stats fetch from a stable 1y series; chart fetches the
  selected window separately.

### More time periods
- Chart periods extended: **1D / 5D / 1M / 6M / YTD / 1Y / 5Y / Max** with
  automatic intraday intervals (5m / 15m / 60m). `PeriodSelector` accepts
  `{value,label}` entries; `market_chart`/`ticker` endpoints accept `interval`
  and use full timestamps (time-of-day axis labels for intraday).

### Zoom & pan on the chart (TradingView-style)
- `CandlestickChart` rewritten: wheel zoom at cursor, drag pan when zoomed,
  double-click reset, **range navigator strip** (drag window to pan, pull edges
  to resize, click outside to jump), "⟲ Reset" button when zoomed, usage hint.
- Window state resets when the dataset changes.

### More filters
- **Screener** (backend + UI): new metrics momentum_1m/3m, annualized 30d
  volatility, avg volume 30d, **relative volume** (today's volume projected to
  a full session, Yahoo-style, vs prior 30 full days). New filters: price
  min/max, day-change min/max, 1M momentum, volatility max, rel-volume min.
  11 one-click presets (oversold/overbought, near high, up/downtrend,
  gainers/losers, unusual volume, momentum, low vol). Collapsible filter
  panel; sortable columns for all new metrics.
- **Portfolio**: sortable headers for Value / P&L / Day.

---

## Round 7 — Wider ticker detail page

- The single-stock page felt cramped: it inherited the app's global
  `max-width: 1180px` container, leaving large empty margins on wide screens.
- Added an `app--wide` modifier on the root shell (`.app` in `App.jsx`) set
  only on `#/ticker/SYMBOL` routes, with `.app--wide .container` widened to
  `96vw` (near full-width, keeping the 24px side padding) in `styles.css`.
  Header, main content, and footer stay aligned because they all share the
  same container.
- The price chart reflows automatically (it observes its container width with
  `ResizeObserver`), so the extra room goes to the candlesticks.

---

## Round 8 — Fix janky hover on long chart ranges

- **Symptom**: with the `Max` period the price chart felt glitchy/jittery while
  moving the mouse over it. Cause: `Max` returns the full daily history
  (~11,500 rows for AAPL), and `CandlestickChart` rendered a wick line + body
  rect + volume rect for *every* row (~34,000 SVG nodes). Every `mousemove`
  called `setHover`, re-rendering all of them, so the crosshair and tooltip
  lagged. At full zoom the bars were also sub-pixel (~0.3px), reading as noise.
- **Fix** (`components/CandlestickChart.jsx`):
  - **Aggregation** — rows are folded into buckets whenever a row would be
    thinner than ~2px, so at most ~`plotW/2` bars are drawn (11,500 → ≤ ~800),
    with proper OHLC high/low and summed volume per bucket. Zoomed-in views
    (bucket = 1) are unchanged and still show raw daily candles.
  - **Memoised static layers** — the candle, volume bar, overlay-path and
    range-navigator layers are `useMemo`'d on `geo`, so a hover now re-renders
    only the crosshair line and tooltip.
  - **Hover guard** — `setHover` is a no-op when the index hasn't changed,
    avoiding redundant renders while moving within one bar.
  - Hover hit-testing, the tooltip (raw daily OHLC), crosshair, date ticks,
    zoom, pan and the navigator all keep their original raw-index behaviour.

---

## Round 9 — Professional "trading terminal" reskin

Redesigned the whole UI away from the bright slate/sky look and playful details,
toward a restrained graphite trading-terminal aesthetic (Bloomberg / TradingView
/ Finviz as references) with an amber highlight and classic green/red.

### Color system (`styles.css` — `:root` + `[data-theme="light"]`)
- **Dark**: near-black graphite surfaces (`#0b0c0f` → `#21252b`), hairline
  borders, muted grey text, an amber/gold accent (`#e0a13b`), and calmer
  directional colors (green `#2fbf71`, red `#e5544b`).
- **Light**: crisp white cards with charcoal text and a darker gold accent.
- New tokens: `--accent-soft` / `--accent-faint` (tints), `--chart-sma20/50/
  bollinger`, `--cat-1…8` (categorical palette), `--font-sans` / `--font-mono`.

### Polish (less "cartoonish")
- Radii tightened across the board (cards 14→8px, controls 8→6px, modals
  16→10px, pills → 6px, segmented/overlay toggles → 4px).
- Removed the pulsing "Live" halo animation and the mover-card hover lift;
  softened dropdown shadows.
- Numeric readouts (prices, scores, tables) now use tabular figures.
- Emoji replaced with clean inline SVG icons (`components/Icons.jsx`):
  brand pulse mark, sun/moon theme toggle, refresh, star (pin), alert.

### Charts now fully theme-driven
- Added `hooks/useThemeColors.js`, which resolves CSS variables to concrete
  colors for SVG *attributes* (where `var()` is invalid) and re-reads on theme
  change. `SentimentGauge`, `HistoryChart` and `BacktestPage` use it instead of
  hardcoded hex (`#38bdf8`, `#ffffff`, `#94a3b8`).
- Candlestick overlays use `--chart-sma20/50` and `--chart-bollinger`;
  allocation chart uses `--cat-*`; `CATEGORY_COLORS` in `utils.js` now resolves
  to theme variables.

---

## Round 10 — Render error boundary

- Added `components/ErrorBoundary.jsx` (class boundary) around the routed page
  in `App.jsx`, inside the existing `Suspense`. Previously a thrown render error
  unmounted the whole app to a blank screen with no explanation.
- On failure it now shows the standard `ErrorState` with the error message and a
  "Retry" button that clears the boundary; the underlying error is also logged
  to the console. Because `<main>` is keyed by route, the boundary resets
  automatically on navigation.

---

## Round 11 — Market sentiment panel redesign

The Overview "Market Sentiment" card felt empty — a fixed 420px-wide SVG gauge
centered in a wide card — and the score-pill-riding-a-gradient read as
toy-like.

- Rewrote `components/SentimentGauge.jsx` as a responsive HTML/CSS panel
  (no SVG) that fills the card:
  - a large tabular **headline score** (`62/100`) with the category label;
  - a **full-width spectrum scale** — thin gradient track, subtle 25/50/75
    ticks, a crisp marker line, and Bearish/Neutral/Bullish zone labels;
  - a **per-signal contribution row** (Volatility / Market Breadth / Trend /
    Strength) with each signal's score and a small bar, so the card is
    informative rather than half-empty.
- CSS: replaced the `.gauge-*` rules with `.sentiment*` styles; the gauge card
  now stretches (`flex: 1`, `space-between`) to line up with the Market
  Overview card. Colors come from theme variables (light/dark aware).
- The detail still lives in the "Signal Breakdown" card below (weights,
  descriptions, raw inputs); this is the at-a-glance summary.

---

## Round 12 — Ticker page fills the width

The single-stock page was a narrow single stack: a full-width chart, then Key
Stats and News one below the other, leaving most of a wide screen unused.

- **Full-bleed container** — `.app--wide .container` changed from `96vw` to
  `max-width: none`, so the ticker route spans the whole viewport (24px gutter).
- **Two-column layout** — `pages/TickerPage.jsx` now wraps Key Stats and News in
  a `.ticker-columns` grid (`1fr / 1.35fr`) below the chart, so the lower half
  of the page uses its horizontal space instead of stacking.
  - The Key Stats grid drops to 2 columns there and its rows stretch
    (`grid-auto-rows: 1fr`) to match the News card height, so no dead space.
  - Collapses to a single column below 1000px.
- Chart height raised 470 → 520 for a better aspect ratio at full width.

---

## Round 13 — Responsive & touch pass

Made the app usable and interactive across phone / tablet / desktop.

### Chart interaction (`components/CandlestickChart.jsx`)
- **Tap for the tooltip** — touch has no hover, so a tap now sets the crosshair
  and shows the OHLCV tooltip (via pointer events; mouse hover unchanged).
- **Drag to pan** works with touch as well as mouse when zoomed.
- **On-screen zoom buttons** (`−` / `+`) in the chart toolbar, so zooming no
  longer depends on a mouse wheel.
- `touch-action: pan-y` on the chart lets the page scroll vertically while
  horizontal drags pan the chart; added `onPointerCancel` handling.

### Responsiveness (`styles.css`)
- `min-height: 100dvh`, `viewport-fit=cover` + `env(safe-area-inset-*)` padding.
- ≤640px: smaller container/card padding, page titles scaled down, search input
  and results go full width, comfortable 38px tap targets, movers arrows hidden
  (swipe instead).
- The period/segmented controls (8 buttons) now **scroll horizontally** instead
  of overflowing; the nav scrolls without a visible scrollbar on small screens.
- Data tables keep momentum scrolling (`-webkit-overflow-scrolling: touch`).
- **iOS focus-zoom fixed** — form fields use 16px on small screens.
- **Touch feedback** — `:active` states under `@media (hover: none)`;
  `-webkit-tap-highlight-color` cleared; `prefers-reduced-motion` honoured.

### Other
- `SearchBar`: mouse-only `mousedown` swapped for `pointerdown` (works on
  touch), SVG search icon, mobile keyboard hints (`enterKeyHint`, no autocorrect).
- `index.html`: `theme-color` meta (updated on theme toggle in `App.jsx`),
  `color-scheme`, notch-safe viewport.
- Removed dead CSS: the retired ticker-modal rules and their keyframes
  (~120 lines), plus the orphaned `.modal-price` selector.

---

## Round 14 — Self-contained static demo build

The showcase is now a **static site with no backend**. It bundles a real
snapshot of the API responses and does the dynamic work in the browser, which
removes every risk of the split deployment (cold starts, Yahoo rate limits,
ephemeral SQLite, shared public portfolio).

### Snapshot (`backend/capture_demo.py`)
- Captures real responses from the live `app.*` modules into
  `frontend/public/demo/` in ~45 s. One batched 10y daily download plus batched
  1d/5d/1mo intraday downloads cover all 49 symbols. OHLC kept at 4 decimals so
  the client-side backtest matches the server exactly.
- Files: `sentiment.json`, `history.json` (6mo/1y/2y/5y), `summary.json`,
  `movers.json`, `screener.json`, `news-market.json`, `news/{SYM}.json`,
  `tickers/{SYM}.json`, `charts/{SYM}.json` (compact
  `[date,o,h,l,c,v]` arrays), and an `index.json` manifest. ~9.8 MB, loaded
  lazily per page/symbol.

### Data layer
- `frontend/src/api.js` is now a selector: `VITE_DEMO=1` (or a production build
  with no `VITE_API_URL`) loads `api/demo.js`; otherwise `api/live.js`. The
  chosen module is imported lazily, so only its code ships in the build.
- `frontend/src/demo/` — `load.js` (snapshot fetch, slug, period slicing),
  `screener.js` (client-side filter/sort), `backtest.js` (SMA-crossover port of
  `backtest.py`), `indicators.js`, `portfolio.js` (localStorage CRUD).
- Verified with `node scripts/test-demo.mjs`, which runs the real demo layer
  against a preview build (36 checks). The client backtest reproduces
  `backend/app/backtest.py` exactly on the snapshot (AAPL 20/50 5y: +17.6%
  strategy, +137.41% buy & hold, Sharpe 0.27, 17 trades, 41.18% win rate).

### UI
- The header badge shows **Demo** (amber) when the demo layer is active, with a
  tooltip that the data is a frozen snapshot.
- Portfolio subtitle no longer claims backend SQLite persistence.

### Deploy
- The Pages workflow builds the demo by default (no `VITE_API_URL` required) and
  only builds the live layer when the `VITE_API_URL` repository variable is set;
  the hard-fail on a missing variable is gone.
- Added `DEPLOYMENT.md` (demo-first), `.gitattributes` (LF), and an npm
  `test:demo` script.

## Round 15 — Deployed to GitHub Pages

The project went live as a fully static site — no backend, no hosting account,
no secrets. This round covers the deployment scaffolding and the actual go-live;
the demo build itself is Round 14.

### Deploy scaffolding
- `.github/workflows/deploy-pages.yml` — builds `frontend/` and publishes it with
  the official Pages actions (`configure-pages` / `upload-pages-artifact` /
  `deploy-pages`). The site base path is taken from the Pages URL, so project
  subpaths (`/<repo>/`) and user sites (`/`) both work with no configuration.
- `frontend/vite.config.js` — `base` is now configurable via `VITE_BASE`
  (normalised to a leading and trailing slash) so hashed assets resolve under the
  Pages subpath.
- `frontend/index.html` — favicon switched to `%BASE_URL%favicon.svg` so it
  survives the subpath.
- `frontend/src/api.js` — `VITE_API_URL` support with the trailing slash stripped
  (the base origin the deployed client calls).
- `README.md` — added a screenshots gallery and a "Live demo & deployment"
  section.
- `DEPLOYMENT.md` — added (later rewritten demo-first in Round 14).
- `render.yaml`, `backend/Dockerfile`, `backend/.dockerignore` — an optional
  live-backend path (Render blueprint + portable container image), retained but
  not used by the static demo.
- Initialised Git and made the first commit.

### Go live
- Created `github.com/tawfek99/Market-pulse` and pushed `main`.
- Enabled GitHub Pages with **Source: GitHub Actions**; the workflow rebuilds and
  redeploys the demo on every push to `main`.
- Live at **https://tawfek99.github.io/Market-pulse/**.

### Fixes
- **Branch mismatch.** The local branch was `master` while the workflow watched
  `main`; renamed with `git branch -M main` before the first push.
- **Wrong GitHub account.** The first push failed with
  `403 Permission to tawfek99/Market-pulse.git denied to tawfiqkhalil2909-create`
  because Windows had cached credentials for a different account. Signing the
  browser into `tawfek99` and removing the saved `git:https://github.com`
  credential fixed it; the push then succeeded (`main -> main`).

### Notes
- The site updates on any push to `main` (about 2-3 min). Refresh the market data
  by re-running `backend/capture_demo.py` and pushing `frontend/public/demo/`.
- Commits are authored as the placeholder `Market Pulse
  <market-pulse@example.com>` until `git config user.name` / `user.email` are set
  locally.

## Round 16 — Mobile header & chart usability

Follow-up to phone feedback: the header took too much space while scrolling and
the charts were fiddly on touch.

### Shrinking header
- `hooks/useMediaQuery.js` — reactive `window.matchMedia`.
- `components/Header.jsx` — on phones (`≤640px`) the header condenses once the
  page is scrolled down and expands when the user scrolls up, driven by a
  throttled, passive, **direction-based** scroll listener with a small deadband.
  Condensing collapses the nav row (animated via `max-height`) and hides the
  title, tagline, Demo/Live badge and the "Refresh" label; the brand mark, a
  swipeable nav and the icon buttons (search / theme / refresh) remain. The
  phone header is two rows (brand + controls, then nav) instead of three.
- `components/SearchBar.jsx` — new `collapsed` mode: an icon button that expands
  into a full-width overlay search field below the header (submitting, Escape or
  tapping outside collapses it).
- `styles.css` — condensed-header rules, overlay-search styling.

### Chart usability (touch)
- `components/CandlestickChart.jsx`:
  - **Pinch-to-zoom** (two-pointer gesture) in addition to wheel / +− buttons.
  - **Responsive height** (~340px on phones) and a tighter left gutter so the
    candles get more horizontal room.
  - **Bigger range-navigator handles** plus a larger (20px) grab zone on touch.
  - **Tooltip docks top-left** on touch so a finger can't cover it, and is
    hidden while pinching.
  - **Tooltip auto-hides ~0.4s after the finger is lifted** on touch — reliable
    even when the thumb leaves the plot: the pointer is captured on touch-down,
    a `window` `pointerup`/`pointercancel` fallback schedules the hide, and the
    synthetic mouse events mobile browsers emit after a tap are ignored for
    800ms so they can't re-show it.
  - Touch-specific hint text ("Pinch or +/− to zoom…").
- `styles.css` — the chart toolbar scrolls horizontally on phones with larger
  tap targets; the hint realigns to the left.

### Follow-up (mobile smoothness)
- Header condensing is now **direction-based** with a deadband (condense while
  scrolling down past 64px, expand on any upward scroll) instead of an absolute
  threshold, and the CSS animates the nav row's `max-height` collapse rather than
  switching `flex-direction` — the instant layout jump was the source of the
  flicker/glitch.
- `overflow-anchor: none` on `html/body` stops scroll anchoring from fighting
  the height change; `backdrop-filter` is dropped on phones (it repainted every
  scroll frame) in favour of an opaque header.
- **No more sideways page movement:** `overflow-x: clip` +
  `overscroll-behavior-x: none` on `html/body`, and the chart uses
  `touch-action: pan-y` / `overscroll-behavior: contain`, so panning/pinching the
  chart can't drag the whole page.
- On phones the search is always the expanding icon (the full input was the main
  space hog), and the phone header is two rows instead of three.
- The header is now **opaque** (`var(--bg)`, no `backdrop-filter`) at every
  size. The previous frosted translucency let page content show through while
  scrolling, which read as the header overlapping the content.

### Verification
- `npm run build` passes (default demo build). Not machine-verified visually —
  no browser input in this environment — so it is confirmed on a real phone.

## API reference (current)

| Method | Path                      | Notes                                    |
| ------ | ------------------------- | ---------------------------------------- |
| GET    | `/api/health`             | Health check                             |
| GET    | `/api/sentiment`          | Composite score + breakdown              |
| GET    | `/api/sentiment/history`  | Historical score series                  |
| GET    | `/api/market/summary`     | Index quotes (S&P, Nasdaq, Dow, VIX)     |
| GET    | `/api/market/chart`       | OHLCV; `period` 1d…max, `interval` 5m…1d |
| GET    | `/api/search`             | Ticker autocomplete                      |
| GET    | `/api/ticker/{ticker}`    | Quote + stats + OHLCV (period/interval)  |
| GET    | `/api/market/movers`      | Top gainers / losers                     |
| GET    | `/api/screener`           | 14 filter params + 9 sort keys           |
| GET    | `/api/news/market`        | Market headline sentiment (VADER)        |
| GET    | `/api/news/{ticker}`      | Per-ticker headline sentiment            |
| GET    | `/api/backtest`           | SMA-crossover backtest                   |
| GET    | `/api/portfolio`          | Holdings + live P&L                      |
| POST   | `/api/portfolio`          | Add holding (409 duplicate)              |
| PUT    | `/api/portfolio/{id}`     | Update shares / cost basis               |
| DELETE | `/api/portfolio/{id}`     | Remove holding                           |

## Known limitations / notes

- Intraday data from Yahoo can lag ~15 min during market hours.
- VADER is lexicon-based and headline-only — scores are transparent, not a
  trading signal.
- Backtest ignores fees, slippage, dividends; SMA crossover usually
  underperforms buy-and-hold (by design, it's an honest demonstration).
- Screener universe is the curated 45-name `MOVERS_BASKET`, not the whole
  market.
- Portfolio data is stored locally in `backend/market_pulse.db` (gitignored).
- Session screenshots could not be visually verified by the model (no image
  input in this environment) — visual changes were verified by build + API
  tests and user feedback.
- The deployed demo shows a fixed data snapshot (refresh with
  `backend/capture_demo.py`); only the order of magnitude is current.
- Demo portfolio data is per-browser (localStorage) — it does not sync across
  devices or browsers.

## Roadmap (candidates, not started)

- pytest suite for sentiment math, screener, backtest, portfolio CRUD
- Live-data deployment on Render/Railway/Fly — the static demo already ships on
  GitHub Pages (Round 15); `render.yaml` + `backend/Dockerfile` cover the
  optional live path
- Ticker comparison page
- Price/RSI alerts with browser notifications
- CSV export for screener/backtest results
- Sector/industry metadata in screener (needs a fundamentals source)
- AI market digest (optional LLM key)
