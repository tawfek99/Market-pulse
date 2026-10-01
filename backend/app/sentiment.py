"""Composite market sentiment scoring from market-derived signals.

This is a deterministic, rule-based model (explicitly no machine learning).
Four market signals are each mapped to a 0-100 "bullishness" score and blended
with fixed weights into a single composite sentiment score:

  * volatility  — VIX level and its 20-day trend (the "fear gauge")
  * breadth     — share of large-caps above their 50-day average
  * trend       — S&P 500 vs its 50/200-day averages plus 20-day momentum
  * strength    — distance from the 52-week high
"""
import numpy as np
import pandas as pd

from . import config, data, indicators


def _clip(s: pd.Series, low: float = 0.0, high: float = 100.0) -> pd.Series:
    return s.clip(lower=low, upper=high)


def volatility_component(vix: pd.Series, lookback: int = 20) -> pd.Series:
    """Map VIX level + 20-day change to a 0-100 score (higher = calmer)."""
    base = pd.Series(
        np.select(
            [vix < 13, vix < 15, vix < 18, vix < 21, vix < 25, vix < 30],
            [90.0, 78.0, 62.0, 48.0, 34.0, 20.0],
            default=10.0,
        ),
        index=vix.index,
    )
    delta = vix - vix.shift(lookback)  # rising VIX => more fear => penalty
    adj = (-delta * 3.0).clip(lower=-25.0, upper=25.0)
    return _clip(base + adj)


def trend_component(close, ma50, ma200) -> pd.Series:
    """Score the S&P 500's relationship to its moving averages + momentum."""
    score = pd.Series(50.0, index=close.index)
    score = score + np.where(close > ma50, 15.0, -15.0)
    score = score + np.where(close > ma200, 15.0, -15.0)
    mom20 = indicators.momentum(close, 20)
    score = score + (mom20 * 200.0).clip(lower=-15.0, upper=15.0)
    return _clip(score)


def strength_component(pct_high: pd.Series) -> pd.Series:
    """Score distance from the 52-week high (near highs = stronger)."""
    return _clip(100.0 + pct_high * 500.0)


def categorize(score: pd.Series) -> pd.Series:
    return pd.Series(
        np.select(
            [
                score >= config.CATEGORY_THRESHOLDS["bullish"],
                score >= config.CATEGORY_THRESHOLDS["neutral"],
            ],
            ["Bullish", "Neutral"],
            default="Bearish",
        ),
        index=score.index,
    )


def build_sentiment_frame(period: str = "1y") -> pd.DataFrame:
    """Build a DataFrame with the raw signals and composite score per day."""
    spx_sym = config.MARKET_INDICES["sp500"]
    vix_sym = config.MARKET_INDICES["vix"]

    idx = data.download_history([spx_sym, vix_sym], period=period)
    spx = data.close_series(idx, spx_sym)
    vix = data.close_series(idx, vix_sym)

    basket = data.download_history(config.BREADTH_TICKERS, period=period)
    closes = basket["Close"] if isinstance(basket.columns, pd.MultiIndex) else basket

    spx_ma50 = indicators.sma(spx, 50)
    spx_ma200 = indicators.sma(spx, 200)
    pct_high = indicators.pct_from_high(spx, 252)
    mom20 = indicators.momentum(spx, 20)
    breadth = indicators.breadth_pct_above_ma(closes, 50).reindex(spx.index)

    vol = volatility_component(vix)
    trend = trend_component(spx, spx_ma50, spx_ma200)
    strength = strength_component(pct_high)

    score = (
        config.WEIGHTS["volatility"] * vol
        + config.WEIGHTS["breadth"] * breadth
        + config.WEIGHTS["trend"] * trend
        + config.WEIGHTS["strength"] * strength
    )

    frame = pd.DataFrame(
        {
            "vix": vix,
            "vix_20d_ago": vix.shift(20),
            "spx": spx,
            "spx_ma50": spx_ma50,
            "spx_ma200": spx_ma200,
            "mom20": mom20,
            "pct_high": pct_high,
            "breadth": breadth,
            "volatility": vol,
            "trend": trend,
            "strength": strength,
            "score": score,
        }
    )
    frame["category"] = categorize(frame["score"])
    return frame.dropna(subset=["score"])


def sentiment_history(period: str = "1y") -> list[dict]:
    """Return the composite score time series as a list of records."""
    frame = build_sentiment_frame(period)
    return [
        {
            "date": ts.date().isoformat(),
            "score": round(float(row["score"]), 1),
            "category": row["category"],
        }
        for ts, row in frame.iterrows()
    ]


def _round(value, digits: int = 2):
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return None
    return round(float(value), digits)


def current_sentiment(period: str = "1y") -> dict:
    """Compute the latest composite score with a per-component breakdown."""
    frame = build_sentiment_frame(period)
    last = frame.iloc[-1]
    ts = frame.index[-1]

    components = [
        {
            "name": "Volatility",
            "description": "VIX level and 20-day trend. Low, falling volatility is bullish.",
            "score": round(float(last["volatility"]), 1),
            "weight": config.WEIGHTS["volatility"],
            "detail": {
                "vix": _round(last["vix"]),
                "vix_20d_ago": _round(last["vix_20d_ago"]),
                "change_20d": _round(last["vix"] - last["vix_20d_ago"]),
            },
        },
        {
            "name": "Market Breadth",
            "description": "Share of large-cap stocks trading above their 50-day average.",
            "score": round(float(last["breadth"]), 1),
            "weight": config.WEIGHTS["breadth"],
            "detail": {"pct_above_50d_ma": _round(last["breadth"])},
        },
        {
            "name": "Trend",
            "description": "S&P 500 vs its 50/200-day averages plus 20-day momentum.",
            "score": round(float(last["trend"]), 1),
            "weight": config.WEIGHTS["trend"],
            "detail": {
                "spx": _round(last["spx"]),
                "above_50d": bool(last["spx"] > last["spx_ma50"]),
                "above_200d": bool(last["spx"] > last["spx_ma200"]),
                "momentum_20d_pct": _round(last["mom20"] * 100),
            },
        },
        {
            "name": "Strength",
            "description": "Distance from the 52-week high. Near highs is bullish.",
            "score": round(float(last["strength"]), 1),
            "weight": config.WEIGHTS["strength"],
            "detail": {"pct_from_52w_high": _round(last["pct_high"] * 100)},
        },
    ]

    score = round(float(last["score"]), 1)
    return {
        "as_of": ts.to_pydatetime().isoformat(),
        "score": score,
        "category": last["category"],
        "summary": _summarize(score, last["category"], components),
        "components": components,
    }


def _summarize(score: float, category: str, components: list[dict]) -> str:
    top = max(components, key=lambda c: c["score"] * c["weight"])
    return (
        f"The market is showing a {category.lower()} bias "
        f"(composite score {score}/100), led by {top['name'].lower()}."
    )
