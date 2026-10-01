# Deploying Market Pulse

There are two ways to run this app, and the deployed showcase uses the first:

| Mode | Backend needed? | Data | Where it runs |
| ---- | --------------- | ---- | ------------- |
| **Demo build** (default) | **No** | Frozen snapshot, bundled | GitHub Pages |
| **Live build** | Yes (FastAPI) | Live Yahoo Finance | Pages + a Python host |

The **demo build is the recommended showcase**: a single static site, no server,
no cold starts, no API keys. The screener and backtest still genuinely compute
in the browser, and the portfolio persists per visitor.

---

## 1. Deploy the demo to GitHub Pages

That's it — there is no backend step.

1. Push the project to GitHub (see §5 if it isn't a repo yet).
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Push to `main`, or run **Actions → "Deploy frontend to GitHub Pages" →
   Run workflow**.

The site goes live at `https://<your-user>.github.io/<repo>/`.

The workflow builds with `VITE_DEMO=1` when the `VITE_API_URL` repository
variable is **not** set (the default), and derives the correct base path from
the Pages URL automatically.

> A project repo is served from a subpath (`/<repo>/`); a `<user>.github.io`
> repo is served from `/`. Both are handled — you don't configure the base path.

---

## How the demo works

The deployed site has no server. It ships a **real snapshot of the API
responses** (`frontend/public/demo/`) and does the dynamic work client-side:

- **Charts, quotes, news, sentiment** — read the frozen snapshot.
- **Screener** — filtering and sorting run in the browser
  (`frontend/src/demo/screener.js`), mirroring the backend rules.
- **Backtest** — the SMA-crossover is recomputed in the browser
  (`frontend/src/demo/backtest.js`), a port of `backend/app/backtest.py`.
- **Portfolio** — add/edit/remove persist in **localStorage**, per visitor.

The code chooses its data layer in `frontend/src/api.js`: `VITE_DEMO=1` uses the
demo layer, otherwise it uses the live API in `frontend/src/api/live.js`.

### Refreshing the snapshot

Data is only as fresh as the last capture. To update it:

```bash
cd backend
python capture_demo.py        # ~1 minute, writes frontend/public/demo/
cd ..
git add frontend/public/demo
git commit -m "Refresh demo snapshot"
git push
```

The header shows a **Demo** badge whenever the demo layer is active, so nobody
mistakes the snapshot for live data.

---

## 2. Preview the demo build locally

```bash
cd frontend
npm run build                 # defaults to the demo build in production mode
npm run preview               # serves dist/ (usually http://localhost:4173/)
```

Run the automated smoke test of the demo layer against the preview server:

```bash
# in another terminal, after `npm run preview`
node scripts/test-demo.mjs
# or point it elsewhere: $env:DEMO_BASE="http://localhost:4173/" ; node scripts/test-demo.mjs
```

It exercises the real `src/api/demo.js` against the snapshot (36 checks:
charts, screener filters/sorts, backtest math, portfolio CRUD).

---

## 3. (Optional) Live-data build

If you'd rather show live prices, host the FastAPI backend and point the build
at it. Everything else in the workflow stays the same.

1. **Deploy the backend.** [`render.yaml`](../render.yaml) is a one-click Render
   blueprint (`rootDir: backend`, `uvicorn app.main:app --host 0.0.0.0 --port
   $PORT`). `backend/Dockerfile` works on any other container host (Railway,
   Fly.io, Hugging Face Spaces, Cloud Run...).
2. Confirm `https://<api-host>/api/health` returns
   `{"status":"ok","service":"market-pulse"}`.
3. **Settings → Secrets and variables → Actions → Variables → New repository
   variable**: `VITE_API_URL` = `https://<api-host>` (no trailing slash, no
   `/api`).
4. Re-run the deploy workflow. With `VITE_API_URL` set, the workflow builds the
   live layer instead of the demo.

**Caveats of the live path** (why the demo is the default):

- Render's free tier sleeps after ~15 min idle → 30–60 s cold starts.
- Yahoo Finance rate-limits/blocks datacenter IPs → intermittent `502`s.
- The portfolio SQLite file is ephemeral on free hosts → holdings reset.
- The portfolio is public and unauthenticated → any visitor can edit it.

---

## 4. Local development (live, unchanged)

```bash
# terminal 1 — API on :8000
cd backend
python -m uvicorn app.main:app --port 8000 --log-level warning

# terminal 2 — Vite dev server on :5173, proxies /api to the backend
cd frontend
npm run dev
```

In dev the demo layer is off, so you get the real API through the proxy.

---

## 5. Push the project to GitHub

The project ships as a non-repo folder; initialise it once:

```bash
git init
git add .
git commit -m "Market Pulse: full-stack sentiment dashboard"
git branch -M main
# create an empty repo on GitHub named, say, "market-pulse", then:
git remote add origin https://github.com/<your-user>/market-pulse.git
git push -u origin main
```

---

## Why hash routing helps

Routes are URL hashes (`#/screener`, `#/ticker/AAPL`), so Pages never requests
those as separate paths. Deep links work on GitHub Pages **without** a
`404.html` SPA-fallback hack.

---

## Troubleshooting

| Symptom | Cause / fix |
| ------- | ----------- |
| Blank page, assets 404 | Pages base path wrong — re-run the workflow (it derives it). |
| Header shows "Demo" but you wanted live | Set `VITE_API_URL` and re-run the workflow. |
| Demo shows stale numbers | Re-run `backend/capture_demo.py` and push. |
| Portfolio empty after switching browsers | Expected — localStorage is per browser/profile. |
| Live build: 502s | Yahoo blocked the host IP; retry or move the host. |
| Live build: slow first load | Free-host cold start; the demo build avoids this. |
