"""Lightweight technical indicators used to build the sentiment score.

Everything here is a simple, deterministic calculation over price history —
moving averages, momentum, distance from highs, and market breadth.
"""
import pandas as pd


def sma(series: pd.Series, window: int) -> pd.Series:
    """Simple moving average."""
    return series.rolling(window=window, min_periods=window).mean()


def momentum(series: pd.Series, lookback: int = 20) -> pd.Series:
    """Percentage change over `lookback` periods."""
    return series.pct_change(periods=lookback)


def pct_from_high(series: pd.Series, window: int = 252) -> pd.Series:
    """Percentage distance below the rolling `window`-period high."""
    high = series.rolling(window=window, min_periods=1).max()
    return series / high - 1.0


def breadth_pct_above_ma(closes: pd.DataFrame, window: int = 50) -> pd.Series:
    """Percentage of tickers (columns) currently above their moving average."""
    mas = closes.rolling(window=window, min_periods=window).mean()
    above = closes > mas
    return above.mean(axis=1) * 100.0


def rsi(series: pd.Series, window: int = 14) -> pd.Series:
    """Relative Strength Index (Wilder's smoothing)."""
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / window, min_periods=window, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / window, min_periods=window, adjust=False).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))
