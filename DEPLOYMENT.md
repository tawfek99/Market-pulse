# Deploying Market Pulse

This app has two parts that both need to run:

- **Frontend** (`frontend/`) — React + Vite. Static files, so it can live on
  **GitHub Pages**.
- **Backend** (`backend/`) — FastAPI + yfinance. A long-running Python service
  that fetches live market data, so it **cannot** run on GitHub Pages. It needs
  a normal web host.

The setup below puts the UI on GitHub Pages and the API on a free host
(Render), then wires them together. Estimated time: ~10 minutes.

> **Why not Pages alone?** GitHub Pages only serves static files. The sentiment,
> screener, backtest, portfolio, news and quote features all need the FastAPI
> process, so a static-only deploy would show the shell but none of the live
> functionality.

---

## 1. Push the project to GitHub

The project is not a git repository yet. From the project root:

```bash
git init
git add .
git commit -m "Market Pulse: full-stack sentiment dashboard"
git branch -M main
# Create an empty repo on GitHub named, say, "market-pulse", then:
git remote add origin https://github.com/<your-user>/market-pulse.git
git push -u origin main
```

The repo name matters: on a **project** Pages site the UI is served from
`https://<your-user>.github.io/<repo>/`. The workflow detects this
automatically (via `actions/configure-pages`), so you don't need to hardcode it.

---

## 2. Deploy the backend (Render, free tier)

1. Sign in at <https://render.com> with GitHub.
2. **New + → Blueprint**, select this repository. Render reads
   [`render.yaml`](../render.yaml) and creates a `market-pulse-api` web service
   (`rootDir: backend`, started with
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT`).
3. Wait for the first build, then copy the service URL — it looks like
   `https://market-pulse-api.onrender.com`.
4. Confirm it's alive: open `https://market-pulse-api.onrender.com/api/health`
   → should return `{"status":"ok","service":"market-pulse"}`.

**Alternatives to Render:** the `backend/Dockerfile` works on any container
host — Railway, Fly.io, Hugging Face Spaces, Google Cloud Run, etc. Any of them
is fine as long as the result is a public HTTPS origin that serves `/api/...`.

> **Free-tier notes**
> - Render's free web service spins down after ~15 min idle; the first request
>   afterwards can take 30–60 s (cold start). The UI's loading skeletons cover
>   this.
> - Yahoo Finance sometimes rate-limits requests from cloud IPs. If many
>   endpoints start returning `502`, that's why — the in-memory cache (30 min)
>   usually smooths it over. Try another region/host if it persists.

---

## 3. Point the frontend at the backend

Back on GitHub: **Settings → Secrets and variables → Actions → Variables → New
repository variable**

| Name            | Value                                             |
| --------------- | ------------------------------------------------- |
| `VITE_API_URL`  | `https://market-pulse-api.onrender.com` (no trailing slash, no `/api`) |

This is injected at build time. The client calls `${VITE_API_URL}/api/...`, and
the backend already allows cross-origin requests (CORS `*`), so no extra config
is needed.

The deploy workflow **fails deliberately** if `VITE_API_URL` is unset — better
than publishing a UI that silently calls `/api` on `github.io` and 404s.

---

## 4. Enable GitHub Pages

**Settings → Pages → Build and deployment → Source: GitHub Actions**.

Then run the deploy: push to `main`, or go to **Actions → "Deploy frontend to
GitHub Pages" → Run workflow**. When it's green, the site is live at:

```
https://<your-user>.github.io/<repo>/
```

---

## How the pieces fit

```
Browser  ──►  https://<user>.github.io/<repo>/        (static React build, Pages)
   │
   └──fetch──►  https://<api-host>/api/...             (FastAPI + yfinance)
```

| File                                  | Purpose                                                     |
| ------------------------------------- | ----------------------------------------------------------- |
| `.github/workflows/deploy-pages.yml`  | Builds `frontend/` and publishes it to Pages                |
| `render.yaml`                         | Blueprint that deploys the FastAPI backend on Render        |
| `backend/Dockerfile`                  | Container image for non-Render hosts                        |
| `frontend/vite.config.js`             | Reads `VITE_BASE` so assets resolve under the Pages subpath |
| `frontend/src/api.js`                 | Reads `VITE_API_URL` to reach the deployed backend          |

---

## Local development (unchanged)

The dev server still proxies `/api` to `localhost:8000`, so nothing here changes
day-to-day:

```bash
# terminal 1
cd backend && uvicorn app.main:app --reload --port 8000
# terminal 2
cd frontend && npm run dev
```

To preview a production build with a real backend locally:

```bash
cd frontend
$env:VITE_API_URL = "http://localhost:8000"   # PowerShell
npm run build && npm run preview
```

---

## Why hash routing helps here

The app routes with URL hashes (`#/screener`, `#/ticker/AAPL`). Pages never sees
those as separate paths, so deep links work on GitHub Pages **without** a
`404.html` SPA-fallback hack.

---

## Troubleshooting

| Symptom                                  | Cause / fix                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| Blank page, assets 404                   | Pages base path wrong. Re-run the workflow (it derives it automatically).|
| UI loads, every panel shows a fetch error| `VITE_API_URL` missing/wrong, or backend asleep/offline.                 |
| `502` from many endpoints                | Yahoo blocked/rate-limited the host IP; retry or move the backend host.  |
| CORS error in the console                | Backend `allow_origins` changed from `*`; add the Pages origin back.      |
| First load very slow                     | Free-host cold start — expected; subsequent loads use the cache.         |
| Screener/backtest empty                  | Yahoo data hiccup — hit the refresh button in the header.                |
