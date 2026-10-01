"""Rule-based strategy backtesting.

Backtests a simple moving-average crossover strategy (fast MA above slow MA
= long, otherwise flat) against buy-and-hold on the same ticker, and reports
standard performance metrics: total return, CAGR, max drawdown, Sharpe ratio,
volatility, and a per-trade ledger with win rate.

Deliberately transparent — the whole strategy is ~10 lines of pandas.
"""
import numpy as np
import pandas as pd

from . import data, indicators


def _round(value, digits: int = 2):
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return None
    return round(float(value), digits)


def _metrics(equity: pd.Series, returns: pd.Series) -> dict:
    total = (equity.iloc[-1] / equity.iloc[0] - 1.0) * 100.0
    years = max(len(equity), 1) / 252.0
    cagr = ((equity.iloc[-1] / equity.iloc[0]) ** (1.0 / years) - 1.0) * 100.0
    drawdown = (equity / equity.cummax() - 1.0).min() * 100.0

    std = returns.std()
    sharpe = None
    if std and not pd.isna(std):
        sharpe = returns.mean() / std * np.sqrt(252)

    volatility = std * np.sqrt(252) * 100.0

    return {
        "total_return_pct": _round(total),
        "cagr_pct": _round(cagr),
        "max_drawdown_pct": _round(drawdown),
        "sharpe": _round(sharpe),
        "volatility_pct": _round(volatility),
    }


def run_backtest(ticker: str, fast: int = 20, slow: int = 50, period: str = "5y") -> dict:
    """Run an SMA crossover backtest vs buy-and-hold for one ticker."""
    symbol = ticker.upper().strip()
    if fast < 2 or slow < 2:
        raise ValueError("MA windows must be at least 2.")
    if fast >= slow:
        raise ValueError("The fast window must be smaller than the slow window.")

    frame = data.download_history([symbol], period=period)
    if frame is None or frame.empty:
        raise ValueError(f"No data available for '{symbol}'.")

    ohlcv = frame.xs(symbol, axis=1, level=1) if isinstance(frame.columns, pd.MultiIndex) else frame
    close = ohlcv["Close"].dropna()
    if close.empty:
        raise ValueError(f"No close data available for '{symbol}'.")
    if len(close) < slow + 5:
        raise ValueError(f"Not enough history for a {slow}-day window on '{symbol}'.")

    fast_ma = indicators.sma(close, fast)
    slow_ma = indicators.sma(close, slow)
    signal = (fast_ma > slow_ma).astype(float)
    position = signal.shift(1).fillna(0.0)  # enter on the next session

    daily = close.pct_change().fillna(0.0)
    strat_returns = position * daily
    strat_equity = (1.0 + strat_returns).cumprod() * 100.0
    buyhold_equity = (1.0 + daily).cumprod() * 100.0

    # Trade ledger: one trade per position flip.
    trades = []
    entry_i = None
    prev_pos = 0.0
    for i in range(len(position)):
        pos = position.iloc[i]
        if pos > prev_pos and prev_pos == 0.0:
            entry_i = i
        elif pos < prev_pos and prev_pos > 0.0 and entry_i is not None:
            trades.append(_make_trade(close, entry_i, i, closed=True))
            entry_i = None
        prev_pos = pos
    if entry_i is not None:
        trades.append(_make_trade(close, entry_i, len(close) - 1, closed=False))

    wins = sum(1 for t in trades if t["return_pct"] > 0)
    win_rate = wins / len(trades) * 100.0 if trades else None

    equity_points = [
        {
            "date": ts.date().isoformat(),
            "strategy": round(float(strat_equity.iloc[i]), 2),
            "buy_hold": round(float(buyhold_equity.iloc[i]), 2),
        }
        for i, ts in enumerate(close.index)
    ]

    return {
        "ticker": symbol,
        "period": period,
        "fast": fast,
        "slow": slow,
        "as_of": close.index[-1].to_pydatetime().isoformat(),
        "metrics": {
            "strategy": {**_metrics(strat_equity, strat_returns), "trades_count": len(trades), "win_rate_pct": _round(win_rate)},
            "buy_hold": _metrics(buyhold_equity, daily),
        },
        "equity": equity_points,
        "trades": trades,
    }


def _make_trade(close: pd.Series, entry_i: int, exit_i: int, closed: bool) -> dict:
    entry_ts = close.index[entry_i]
    exit_ts = close.index[exit_i]
    entry_price = float(close.iloc[entry_i])
    exit_price = float(close.iloc[exit_i])
    return {
        "entry_date": entry_ts.date().isoformat(),
        "exit_date": exit_ts.date().isoformat() if closed else None,
        "entry_price": round(entry_price, 2),
        "exit_price": round(exit_price, 2) if closed else None,
        "return_pct": round((exit_price / entry_price - 1.0) * 100.0, 2),
        "days": int((exit_ts - entry_ts).days),
    }
