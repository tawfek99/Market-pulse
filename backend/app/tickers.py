"""Per-ticker detail and daily market movers.

No machine learning here — just deterministic technical calculations over
price history plus best-effort fundamentals from yfinance.
"""
import numpy as np
import pandas as pd

from . import config, data, indicators


def _round(value, digits: int = 2):
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return None
    return round(float(value), digits)


def _ohlcv(frame, symbol):
    return frame.xs(symbol, axis=1, level=1) if isinstance(frame.columns, pd.MultiIndex) else frame


def ticker_detail(ticker: str, period: str = "1y", interval: str = "1d") -> dict:
    """Return quote info, key stats, and an OHLCV series for one ticker."""
    symbol = ticker.upper().strip()
    frame = data.download_history([symbol], period=period, interval=interval)
    if frame is None or frame.empty:
        raise ValueError(f"No data available for '{symbol}'.")

    ohlcv = _ohlcv(frame, symbol)
    close = ohlcv["Close"].dropna()
    if close.empty:
        raise ValueError(f"No close data available for '{symbol}'.")

    price = float(close.iloc[-1])
    prev = float(close.iloc[-2]) if len(close) >= 2 else price
    change = price - prev
    change_pct = (change / prev * 100) if prev else 0.0

    ma50 = indicators.sma(close, 50)
    ma200 = indicators.sma(close, 200)
    rsi14 = indicators.rsi(close, 14)
    high_52 = close.rolling(252, min_periods=1).max().iloc[-1]
    low_52 = close.rolling(252, min_periods=1).min().iloc[-1]

    meta = data.get_ticker_meta(symbol)

    info = {
        "symbol": symbol,
        "name": meta.get("name") or symbol,
        "currency": meta.get("currency"),
        "price": _round(price),
        "change": _round(change),
        "change_pct": _round(change_pct),
    }

    stats = {
        "market_cap": _round(meta.get("market_cap"), 0),
        "pe_ratio": _round(meta.get("pe_ratio")),
        "avg_volume": _round(meta.get("avg_volume"), 0),
        "sma50": _round(ma50.iloc[-1]),
        "sma200": _round(ma200.iloc[-1]),
        "rsi14": _round(rsi14.iloc[-1]),
        "fifty_two_week_high": _round(high_52),
        "fifty_two_week_low": _round(low_52),
    }

    chart = []
    for ts, row in ohlcv.iterrows():
        chart.append(
            {
                "date": ts.to_pydatetime().isoformat(),
                "open": round(float(row["Open"]), 4),
                "high": round(float(row["High"]), 4),
                "low": round(float(row["Low"]), 4),
                "close": round(float(row["Close"]), 4),
                "volume": float(row["Volume"]) if "Volume" in row and not pd.isna(row["Volume"]) else 0.0,
            }
        )

    return {"info": info, "stats": stats, "chart": chart}


def movers(limit: int = 5) -> dict:
    """Compute the day's biggest gainers and losers from a liquid basket."""
    symbols = list(config.MOVERS_BASKET.keys())
    frame = data.download_history(symbols, period="5d")
    closes = frame["Close"] if isinstance(frame.columns, pd.MultiIndex) else frame

    last = closes.iloc[-1]
    prev = closes.iloc[-2]
    change_pct = (last - prev) / prev * 100

    rows = []
    for sym in symbols:
        if sym in change_pct and pd.notna(change_pct[sym]) and pd.notna(last[sym]):
            rows.append(
                {
                    "symbol": sym,
                    "name": config.MOVERS_BASKET.get(sym, sym),
                    "price": round(float(last[sym]), 2),
                    "change_pct": round(float(change_pct[sym]), 2),
                }
            )

    rows.sort(key=lambda r: r["change_pct"], reverse=True)
    gainers = [r for r in rows if r["change_pct"] > 0][:limit]
    losers = sorted([r for r in rows if r["change_pct"] < 0], key=lambda r: r["change_pct"])[:limit]

    as_of = closes.index[-1].to_pydatetime().isoformat()
    return {"as_of": as_of, "gainers": gainers, "losers": losers}
