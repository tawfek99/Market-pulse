"""Capture a real API snapshot into `frontend/public/demo/`.

The deployed demo build has no backend: it reads these frozen JSON files and
recomputes the rule-based parts (screener filters, SMA-crossover backtest) in
the browser. Run this from `backend/` whenever you want to refresh the demo:

    cd backend
    python capture_demo.py

It reuses the same `app.*` modules the API uses, so the numbers match a live
run exactly. Prices are rounded to 2 decimals and stored as compact arrays
[date, open, high, low, close, volume] to keep the bundle small.
"""
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

# Windows consoles default to cp1252 and can crash on non-ASCII progress output.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass
from fastapi.encoders import jsonable_encoder

from app import config, data, indicators, main, news, screener, sentiment, tickers

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "frontend" / "public" / "demo"

# Daily history length. Powers the charts and the backtest (1y/2y/5y/10y).
DAILY_PERIOD = "10y"

# Intraday windows captured for every symbol (period -> interval).
INTRADAY = {"1d": "5m", "5d": "15m", "1mo": "60m"}

# Per-ticker news is only captured for a few likely-clicked names; the rest
# fall back to the market-wide feed in the demo adapter.
NEWS_SYMBOLS = ["^GSPC", "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL", "META", "SPY"]

INDEX_NAMES = {
    "^GSPC": "S&P 500",
    "^IXIC": "Nasdaq Composite",
    "^DJI": "Dow Jones",
    "^VIX": "CBOE Volatility (VIX)",
}


def slug(symbol: str) -> str:
    """Filesystem/URL-safe key. Must match `slug()` in the frontend demo adapter."""
    return re.sub(r"[^A-Za-z0-9.\-]", "", symbol)


def _round(value, digits=2):
    if value is None:
        return None
    try:
        value = float(value)
    except (TypeError, ValueError):
        return None
    if pd.isna(value):
        return None
    return round(value, digits)


def points(ohlcv: pd.DataFrame) -> list:
    """OHLCV rows as compact arrays: [date, open, high, low, close, volume].

    Prices keep 4 decimals (matching the live API) so the client-side backtest
    compounds to the same result the server would produce.
    """
    rows = []
    for ts, row in ohlcv.iterrows():
        vol = row.get("Volume")
        vol = None if vol is None or pd.isna(vol) else int(vol)
        rows.append(
            [
                ts.isoformat(),
                _round(row["Open"], 4),
                _round(row["High"], 4),
                _round(row["Low"], 4),
                _round(row["Close"], 4),
                vol,
            ]
        )
    return rows


def split(frame: pd.DataFrame, symbols: list[str]) -> dict:
    """Split a batched multi-ticker download into {symbol: OHLCV frame}."""
    out = {}
    if frame is None or frame.empty:
        return out
    for sym in symbols:
        try:
            ohlcv = frame.xs(sym, axis=1, level=1) if isinstance(frame.columns, pd.MultiIndex) else frame
        except KeyError:
            continue
        ohlcv = ohlcv.dropna(subset=["Close"]) if "Close" in ohlcv else ohlcv
        if not ohlcv.empty:
            out[sym] = ohlcv
    return out


def write_json(rel_path: str, payload) -> int:
    path = OUT / rel_path
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, separators=(",", ":"), allow_nan=False)
    path.write_text(text, encoding="utf-8")
    return len(text)


def ticker_stats(symbol: str, ohlcv: pd.DataFrame) -> dict:
    """Reproduce `tickers.ticker_detail` info/stats from a daily series."""
    close = ohlcv["Close"].dropna()
    price = float(close.iloc[-1])
    prev = float(close.iloc[-2]) if len(close) >= 2 else price
    change = price - prev
    change_pct = (change / prev * 100) if prev else 0.0

    meta = data.get_ticker_meta(symbol)
    volume = ohlcv["Volume"].dropna() if "Volume" in ohlcv else pd.Series(dtype=float)
    avg_volume = meta.get("avg_volume")
    if avg_volume is None and not volume.empty:
        avg_volume = _round(volume.tail(30).mean(), 0)

    info = {
        "symbol": symbol,
        "name": meta.get("name") or INDEX_NAMES.get(symbol) or config.MOVERS_BASKET.get(symbol, symbol),
        "currency": meta.get("currency"),
        "price": _round(price),
        "change": _round(change),
        "change_pct": _round(change_pct),
    }
    stats = {
        "market_cap": _round(meta.get("market_cap"), 0),
        "pe_ratio": _round(meta.get("pe_ratio")),
        "avg_volume": _round(avg_volume, 0),
        "sma50": _round(indicators.sma(close, 50).iloc[-1]),
        "sma200": _round(indicators.sma(close, 200).iloc[-1]),
        "rsi14": _round(indicators.rsi(close, 14).iloc[-1]),
        "fifty_two_week_high": _round(close.rolling(252, min_periods=1).max().iloc[-1]),
        "fifty_two_week_low": _round(close.rolling(252, min_periods=1).min().iloc[-1]),
    }
    return {"symbol": symbol, "info": info, "stats": stats}


def main_capture() -> None:
    started = time.time()
    universe = list(config.MOVERS_BASKET.keys())
    indices = list(config.MARKET_INDICES.values())
    all_symbols = universe + indices
    sizes: list[int] = []

    print(f"Universe: {len(universe)} tickers + {len(indices)} indices = {len(all_symbols)}")

    # ---- Market-wide endpoints (reuse the exact API functions) -------------
    print("Capturing sentiment...")
    sizes.append(write_json("sentiment.json", sentiment.current_sentiment("1y")))

    print("Capturing sentiment history...")
    history = {
        p: {"period": p, "points": sentiment.sentiment_history(p)}
        for p in ["6mo", "1y", "2y", "5y"]
    }
    sizes.append(write_json("history.json", history))

    print("Capturing market summary…")
    sizes.append(write_json("summary.json", jsonable_encoder(main.market_summary())))

    print("Capturing movers…")
    sizes.append(write_json("movers.json", jsonable_encoder(tickers.movers(5))))

    print("Capturing screener universe…")
    sizes.append(write_json("screener.json", jsonable_encoder(screener.screen(limit=100))))

    print("Capturing market news…")
    sizes.append(write_json("news-market.json", jsonable_encoder(news.market_news(8))))

    # ---- Batched price downloads -------------------------------------------
    print(f"Downloading {DAILY_PERIOD} daily history (batch)…")
    daily_frame = data.download_history(all_symbols, period=DAILY_PERIOD)
    daily = split(daily_frame, all_symbols)

    intraday: dict[str, dict] = {k: {} for k in INTRADAY}
    for period, interval in INTRADAY.items():
        print(f"Downloading {period} @ {interval} (batch)…")
        frame = data.download_history(all_symbols, period=period, interval=interval)
        intraday[period] = split(frame, all_symbols)

    # ---- Per-symbol chart + ticker detail ----------------------------------
    print("Writing per-symbol files…")
    index_symbols = []
    for sym in all_symbols:
        ohlcv = daily.get(sym)
        if ohlcv is None or ohlcv.empty:
            print(f"  ! no daily data for {sym}, skipping")
            continue

        chart = {
            "symbol": sym,
            "daily": {"period": DAILY_PERIOD, "points": points(ohlcv)},
            "intraday": {
                p: {"interval": INTRADAY[p], "points": points(frames[sym])}
                for p, frames in intraday.items()
                if sym in frames
            },
        }
        sizes.append(write_json(f"charts/{slug(sym)}.json", chart))

        detail = ticker_stats(sym, ohlcv)
        detail["chart"] = points(ohlcv.tail(252))
        sizes.append(write_json(f"tickers/{slug(sym)}.json", detail))

        index_symbols.append(
            {
                "symbol": sym,
                "name": detail["info"]["name"],
                "type": "Index" if sym in indices else "Equity",
            }
        )
        print(f"  ok {sym}")

    # ---- Per-symbol news (best effort) -------------------------------------
    for sym in NEWS_SYMBOLS:
        try:
            sizes.append(write_json(f"news/{slug(sym)}.json", jsonable_encoder(news.ticker_news(sym, 8))))
            print(f"  news ok {sym}")
        except Exception as exc:  # noqa: BLE001 - news is optional
            print(f"  news FAIL {sym}: {exc}")

    # ---- Manifest ----------------------------------------------------------
    manifest = {
        "updated": datetime.now(timezone.utc).isoformat(),
        "daily_period": DAILY_PERIOD,
        "intraday": INTRADAY,
        "periods": ["1d", "5d", "1mo", "6mo", "ytd", "1y", "2y", "5y", "10y", "max"],
        "symbols": index_symbols,
    }
    sizes.append(write_json("index.json", manifest))

    total_mb = sum(sizes) / (1024 * 1024)
    print(f"\nDone in {time.time() - started:.0f}s · {total_mb:.1f} MB written to {OUT}")


if __name__ == "__main__":
    main_capture()
