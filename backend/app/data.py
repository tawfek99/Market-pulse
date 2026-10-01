"""Data access layer.

Fetches market data from Yahoo Finance and caches it in memory so repeated
requests don't hammer the upstream provider. There is no machine learning
here — just a small, thread-safe-ish cache around `yfinance`.
"""
import time

import pandas as pd
import yfinance as yf

from . import config

# In-memory cache: key -> (timestamp, value).
_cache: dict = {}


def _cache_get_or_set(key, ttl_seconds, producer):
    now = time.time()
    entry = _cache.get(key)
    if entry is not None and (now - entry[0]) < ttl_seconds:
        return entry[1]

    value = producer()
    _cache[key] = (now, value)
    return value


def download_history(tickers, period="1y", interval="1d", auto_adjust=True):
    """Download OHLCV history for one or more tickers in a single batch call."""
    tickers = sorted(set(tickers))
    key = ("history", tuple(tickers), period, interval, auto_adjust)

    def _download():
        return yf.download(
            tickers=tickers,
            period=period,
            interval=interval,
            group_by="column",
            auto_adjust=auto_adjust,
            progress=False,
            threads=True,
        )

    return _cache_get_or_set(key, config.CACHE_TTL_SECONDS, _download)


def close_series(frame: pd.DataFrame, ticker: str) -> pd.Series:
    """Extract the Close series for a single ticker from a download result.

    yfinance returns a MultiIndex column layout when given a list of tickers,
    and a flat layout for a single ticker string. This normalizes both.
    """
    if frame is None or frame.empty:
        return pd.Series(dtype=float)
    if isinstance(frame.columns, pd.MultiIndex):
        return frame["Close"][ticker]
    return frame["Close"]


def search(query: str, limit: int = 8) -> list[dict]:
    """Autocomplete search for a ticker/company via yfinance's search API."""
    key = ("search", query.lower().strip(), limit)

    def _run():
        results = []
        for q in (yf.Search(query, max_results=limit).quotes or []):
            symbol = q.get("symbol")
            if not symbol:
                continue
            results.append(
                {
                    "symbol": symbol,
                    "name": q.get("shortname") or q.get("longname"),
                    "exchange": q.get("exchDisp"),
                    "type": q.get("quoteType") or q.get("typeDisp"),
                }
            )
        return results

    return _cache_get_or_set(key, config.SEARCH_CACHE_TTL_SECONDS, _run)


def get_ticker_meta(ticker: str) -> dict:
    """Best-effort per-ticker fundamentals (name, cap, P/E, etc.)."""
    key = ("meta", ticker.upper())

    def _run():
        try:
            info = yf.Ticker(ticker).info or {}
        except Exception:  # noqa: BLE001 - fundamentals are best-effort
            info = {}
        return {
            "name": info.get("shortName") or info.get("longName"),
            "currency": info.get("currency"),
            "quote_type": info.get("quoteType"),
            "market_cap": info.get("marketCap"),
            "pe_ratio": info.get("trailingPE"),
            "avg_volume": info.get("averageVolume"),
        }

    return _cache_get_or_set(key, config.META_CACHE_TTL_SECONDS, _run)
