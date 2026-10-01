"""Stock screener over a curated liquid universe.

Deterministic technical filters — RSI, moving averages, distance from the
52-week high, momentum, realized volatility, and volume activity — computed
from a single batched price download, then filtered and sorted server-side.
"""
import numpy as np
import pandas as pd

from . import config, data, indicators

# Universe: symbol -> display name. Reuses the liquid basket already used for
# market movers so results are fast and reliable (one batched download).
UNIVERSE = config.MOVERS_BASKET

SORT_KEYS = {
    "symbol": "symbol",
    "price": "price",
    "change_pct": "change_pct",
    "rsi14": "rsi14",
    "pct_from_high": "pct_from_high",
    "momentum_1m_pct": "momentum_1m_pct",
    "momentum_3m_pct": "momentum_3m_pct",
    "volatility_30d_pct": "volatility_30d_pct",
    "rel_volume": "rel_volume",
}


def _round(value, digits: int = 2):
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return None
    return round(float(value), digits)


def _build_rows() -> tuple[list[dict], str | None]:
    """Compute one screener row per ticker from a batched history download."""
    symbols = list(UNIVERSE.keys())
    frame = data.download_history(symbols, period="1y")
    if frame is None or frame.empty:
        return [], None

    closes = frame["Close"] if isinstance(frame.columns, pd.MultiIndex) else frame
    volumes = frame["Volume"] if isinstance(frame.columns, pd.MultiIndex) else frame
    as_of = closes.index[-1].to_pydatetime().isoformat()

    rows = []
    for sym in symbols:
        if sym not in closes.columns:
            continue
        close = closes[sym].dropna()
        if len(close) < 60:  # not enough history for stable indicators
            continue

        volume = volumes[sym].dropna() if sym in volumes.columns else pd.Series(dtype=float)
        volume = volume.reindex(close.index).fillna(0.0)

        rsi = indicators.rsi(close, 14).iloc[-1]
        sma50 = indicators.sma(close, 50).iloc[-1]
        sma200 = indicators.sma(close, 200).iloc[-1]
        high_52 = close.rolling(252, min_periods=1).max().iloc[-1]

        price = float(close.iloc[-1])
        prev = float(close.iloc[-2]) if len(close) >= 2 else price
        change_pct = (price - prev) / prev * 100 if prev else 0.0

        # 1- and 3-month momentum (≈22 / ≈64 trading days).
        mom_1m = (price / close.iloc[-22] - 1.0) * 100 if len(close) >= 22 else None
        mom_3m = (price / close.iloc[-64] - 1.0) * 100 if len(close) >= 64 else None

        # Annualized realized volatility from the last 30 daily returns.
        rets = close.pct_change().dropna().tail(30)
        vol_30d = (rets.std() * np.sqrt(252) * 100) if len(rets) >= 20 else None

        avg_vol_30 = volume.tail(31).iloc[:-1].mean()  # prior 30 full sessions

        # Project today's partial-session volume to a full day so relative
        # volume is comparable at any time of day (Yahoo-style).
        last_ts = close.index[-1]
        today_vol = volume.iloc[-1]
        try:
            now_et = last_ts.tz_convert("America/New_York") if last_ts.tz is not None else last_ts
            session_open = now_et.replace(hour=9, minute=30, second=0, microsecond=0)
            elapsed_h = max(0.0, (now_et - session_open).total_seconds() / 3600.0)
            fraction = min(1.0, max(0.05, elapsed_h / 6.5))
            projected = today_vol / fraction
        except Exception:  # noqa: BLE001 - fall back to raw volume
            projected = today_vol
        rel_vol = projected / avg_vol_30 if avg_vol_30 > 0 else None

        rows.append(
            {
                "symbol": sym,
                "name": UNIVERSE.get(sym, sym),
                "price": round(price, 2),
                "change_pct": _round(change_pct),
                "rsi14": _round(rsi),
                "above_sma50": bool(price > sma50) if not pd.isna(sma50) else None,
                "above_sma200": bool(price > sma200) if not pd.isna(sma200) else None,
                "pct_from_high": _round((price / high_52 - 1.0) * 100 if high_52 else None),
                "momentum_1m_pct": _round(mom_1m),
                "momentum_3m_pct": _round(mom_3m),
                "volatility_30d_pct": _round(vol_30d),
                "avg_volume_30d": _round(avg_vol_30, 0),
                "rel_volume": _round(rel_vol),
            }
        )
    return rows, as_of


def screen(
    rsi_min: float | None = None,
    rsi_max: float | None = None,
    above_sma50: bool | None = None,
    above_sma200: bool | None = None,
    within_high_pct: float | None = None,
    change_min: float | None = None,
    change_max: float | None = None,
    price_min: float | None = None,
    price_max: float | None = None,
    momentum_1m_min: float | None = None,
    momentum_1m_max: float | None = None,
    volatility_min: float | None = None,
    volatility_max: float | None = None,
    rel_volume_min: float | None = None,
    avg_volume_min: float | None = None,
    sort_by: str = "symbol",
    order: str = "asc",
    limit: int = 50,
) -> dict:
    """Filter, sort, and paginate the universe. Raises ValueError on bad args."""
    sort_key = SORT_KEYS.get(sort_by)
    if sort_key is None:
        raise ValueError(
            f"Invalid sort_by '{sort_by}'. Use one of {sorted(SORT_KEYS)}."
        )
    if order not in {"asc", "desc"}:
        raise ValueError("Invalid order. Use 'asc' or 'desc'.")

    rows, as_of = _build_rows()

    def keep(row: dict) -> bool:
        if rsi_min is not None and (row["rsi14"] is None or row["rsi14"] < rsi_min):
            return False
        if rsi_max is not None and (row["rsi14"] is None or row["rsi14"] > rsi_max):
            return False
        if above_sma50 is not None and row["above_sma50"] is not above_sma50:
            return False
        if above_sma200 is not None and row["above_sma200"] is not above_sma200:
            return False
        if within_high_pct is not None and (
            row["pct_from_high"] is None or row["pct_from_high"] < -within_high_pct
        ):
            return False
        if change_min is not None and (
            row["change_pct"] is None or row["change_pct"] < change_min
        ):
            return False
        if change_max is not None and (
            row["change_pct"] is None or row["change_pct"] > change_max
        ):
            return False
        if price_min is not None and (row["price"] is None or row["price"] < price_min):
            return False
        if price_max is not None and (row["price"] is None or row["price"] > price_max):
            return False
        if momentum_1m_min is not None and (
            row["momentum_1m_pct"] is None or row["momentum_1m_pct"] < momentum_1m_min
        ):
            return False
        if momentum_1m_max is not None and (
            row["momentum_1m_pct"] is None or row["momentum_1m_pct"] > momentum_1m_max
        ):
            return False
        if volatility_min is not None and (
            row["volatility_30d_pct"] is None or row["volatility_30d_pct"] < volatility_min
        ):
            return False
        if volatility_max is not None and (
            row["volatility_30d_pct"] is None or row["volatility_30d_pct"] > volatility_max
        ):
            return False
        if rel_volume_min is not None and (
            row["rel_volume"] is None or row["rel_volume"] < rel_volume_min
        ):
            return False
        if avg_volume_min is not None and (
            row["avg_volume_30d"] is None or row["avg_volume_30d"] < avg_volume_min
        ):
            return False
        return True

    filtered = [r for r in rows if keep(r)]

    # Sort, keeping rows with a missing sort value last regardless of direction.
    present = [r for r in filtered if r[sort_key] is not None]
    missing = [r for r in filtered if r[sort_key] is None]
    present.sort(key=lambda r: r[sort_key], reverse=order == "desc")
    filtered = present + missing

    return {"as_of": as_of, "count": len(filtered), "results": filtered[:limit]}
