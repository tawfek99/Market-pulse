"""FastAPI application entry point for the Market Pulse sentiment API."""
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

from . import backtest, data, db, news, screener, sentiment, tickers
from .schemas import (
    BacktestResponse,
    ChartPoint,
    ChartResponse,
    HistoryResponse,
    HoldingCreate,
    HoldingOut,
    HoldingUpdate,
    IndexSummary,
    MarketSummaryResponse,
    MoversResponse,
    NewsResponse,
    PortfolioResponse,
    ScreenerResponse,
    SearchResponse,
    SentimentResponse,
    TickerResponse,
)

app = FastAPI(
    title="Market Pulse — Sentiment API",
    description="Market sentiment scoring built from market-derived signals (no ML).",
    version="0.1.0",
)

# Dev-friendly CORS. Restrict `allow_origins` to your frontend origin in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

VALID_PERIODS = {"1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "max"}
DEFAULT_PERIOD = "1y"

# Chart endpoints accept shorter windows + intraday intervals.
CHART_PERIODS = {"1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"}
CHART_INTERVALS = {"1m", "5m", "15m", "30m", "60m", "1d"}

INDEX_LABELS = [
    ("^GSPC", "S&P 500"),
    ("^IXIC", "Nasdaq Composite"),
    ("^DJI", "Dow Jones"),
    ("^VIX", "CBOE Volatility (VIX)"),
]


def _validate_period(period: str) -> str:
    if period not in VALID_PERIODS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid period '{period}'. Use one of {sorted(VALID_PERIODS)}.",
        )
    return period


def _validate_chart(period: str, interval: str) -> None:
    if period not in CHART_PERIODS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid period '{period}'. Use one of {sorted(CHART_PERIODS)}.",
        )
    if interval not in CHART_INTERVALS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid interval '{interval}'. Use one of {sorted(CHART_INTERVALS)}.",
        )


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "market-pulse"}


@app.get("/api/sentiment", response_model=SentimentResponse)
def get_sentiment(period: str = Query(DEFAULT_PERIOD)):
    _validate_period(period)
    try:
        return sentiment.current_sentiment(period)
    except Exception as exc:  # noqa: BLE001 - surface a clean error to the client
        raise HTTPException(status_code=502, detail=f"Could not compute sentiment: {exc}") from exc


@app.get("/api/sentiment/history", response_model=HistoryResponse)
def get_sentiment_history(period: str = Query(DEFAULT_PERIOD)):
    _validate_period(period)
    try:
        return {"period": period, "points": sentiment.sentiment_history(period)}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Could not compute history: {exc}") from exc


@app.get("/api/market/summary", response_model=MarketSummaryResponse)
def market_summary():
    symbols = [s for s, _ in INDEX_LABELS]
    frame = data.download_history(symbols, period="5d")
    indices = []
    as_of = None

    for sym, name in INDEX_LABELS:
        close = data.close_series(frame, sym).dropna()
        if close.empty:
            indices.append(IndexSummary(symbol=sym, name=name, price=None, change=None, change_pct=None))
            continue

        price = float(close.iloc[-1])
        prev = float(close.iloc[-2]) if len(close) >= 2 else price
        change = price - prev
        change_pct = (change / prev * 100) if prev else 0.0

        indices.append(
            IndexSummary(
                symbol=sym,
                name=name,
                price=round(price, 2),
                change=round(change, 2),
                change_pct=round(change_pct, 2),
            )
        )
        as_of = close.index[-1]

    return {
        "as_of": as_of.to_pydatetime().isoformat() if as_of is not None else None,
        "indices": indices,
    }


@app.get("/api/market/chart", response_model=ChartResponse)
def market_chart(
    ticker: str = Query("^GSPC"),
    period: str = Query("6mo"),
    interval: str = Query("1d"),
):
    _validate_chart(period, interval)
    frame = data.download_history([ticker], period=period, interval=interval)
    if frame is None or frame.empty:
        raise HTTPException(status_code=404, detail=f"No data available for ticker '{ticker}'.")

    ohlcv = frame.xs(ticker, axis=1, level=1) if isinstance(frame.columns, pd.MultiIndex) else frame
    points = []
    for ts, row in ohlcv.iterrows():
        points.append(
            ChartPoint(
                date=ts.to_pydatetime().isoformat(),
                open=round(float(row["Open"]), 4),
                high=round(float(row["High"]), 4),
                low=round(float(row["Low"]), 4),
                close=round(float(row["Close"]), 4),
                volume=float(row["Volume"]) if "Volume" in row and not pd.isna(row["Volume"]) else None,
            )
        )
    return {"ticker": ticker, "period": period, "points": points}


@app.get("/api/search", response_model=SearchResponse)
def search(q: str = Query(..., min_length=1), limit: int = Query(8, ge=1, le=20)):
    try:
        return {"results": data.search(q, limit)}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Search failed: {exc}") from exc


@app.get("/api/ticker/{ticker}", response_model=TickerResponse)
def get_ticker(ticker: str, period: str = Query("1y"), interval: str = Query("1d")):
    _validate_chart(period, interval)
    try:
        return tickers.ticker_detail(ticker, period, interval)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Could not load ticker: {exc}") from exc


@app.get("/api/market/movers", response_model=MoversResponse)
def get_movers(limit: int = Query(5, ge=1, le=10)):
    try:
        return tickers.movers(limit)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Could not compute movers: {exc}") from exc


# ---------- Portfolio (SQLite-backed) ----------

def _round(value, digits: int = 2):
    try:
        value = float(value)
    except (TypeError, ValueError):
        return None
    if pd.isna(value):
        return None
    return round(value, digits)


def _enrich_holdings(holdings: list[dict]) -> tuple[list[HoldingOut], Optional[str]]:
    """Attach live quotes (price, day change) to stored holdings."""
    symbols = [h["symbol"] for h in holdings]
    quotes: dict[str, dict] = {}
    as_of = None

    if symbols:
        frame = data.download_history(symbols, period="5d")
        for sym in symbols:
            close = data.close_series(frame, sym).dropna()
            if close.empty:
                continue
            price = float(close.iloc[-1])
            prev = float(close.iloc[-2]) if len(close) >= 2 else price
            quotes[sym] = {
                "price": price,
                "day_change_pct": (price - prev) / prev * 100 if prev else 0.0,
            }
            as_of = close.index[-1].to_pydatetime().isoformat()

    rows = []
    for h in holdings:
        quote = quotes.get(h["symbol"], {})
        price = quote.get("price")
        value = price * h["shares"] if price is not None else None
        cost_value = h["cost_basis"] * h["shares"]
        pnl = value - cost_value if value is not None else None
        pnl_pct = pnl / cost_value * 100 if pnl is not None and cost_value else None
        rows.append(
            HoldingOut(
                id=h["id"],
                symbol=h["symbol"],
                name=h["name"],
                shares=h["shares"],
                cost_basis=h["cost_basis"],
                price=_round(price),
                value=_round(value),
                cost_value=_round(cost_value),
                pnl=_round(pnl),
                pnl_pct=_round(pnl_pct),
                day_change_pct=_round(quote.get("day_change_pct")),
                added_at=h["added_at"],
            )
        )
    return rows, as_of


@app.get("/api/portfolio", response_model=PortfolioResponse)
def get_portfolio():
    try:
        rows, as_of = _enrich_holdings(db.list_holdings())
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Could not load portfolio: {exc}") from exc

    values = [r.value for r in rows if r.value is not None]
    costs = [r.cost_value for r in rows if r.cost_value is not None]
    total_value = sum(values) if values else None
    total_cost = sum(costs) if costs else None
    total_pnl = total_value - total_cost if total_value is not None and total_cost is not None else None
    total_pnl_pct = total_pnl / total_cost * 100 if total_pnl is not None and total_cost else None

    return {
        "as_of": as_of,
        "holdings": rows,
        "total_value": _round(total_value),
        "total_cost": _round(total_cost),
        "total_pnl": _round(total_pnl),
        "total_pnl_pct": _round(total_pnl_pct),
    }


@app.post("/api/portfolio", response_model=HoldingOut, status_code=201)
def add_holding(payload: HoldingCreate):
    symbol = payload.symbol.upper().strip()
    try:
        stored = db.add_holding(symbol, payload.name, payload.shares, payload.cost_basis)
        rows, _ = _enrich_holdings([stored])
        return rows[0]
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Could not save holding: {exc}") from exc


@app.put("/api/portfolio/{holding_id}", response_model=HoldingOut)
def update_holding(holding_id: int, payload: HoldingUpdate):
    try:
        stored = db.update_holding(holding_id, payload.shares, payload.cost_basis)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Could not update holding: {exc}") from exc
    if stored is None:
        raise HTTPException(status_code=404, detail="Holding not found.")
    rows, _ = _enrich_holdings([stored])
    return rows[0]


@app.delete("/api/portfolio/{holding_id}", status_code=204)
def delete_holding(holding_id: int):
    if not db.delete_holding(holding_id):
        raise HTTPException(status_code=404, detail="Holding not found.")


# ---------- Screener ----------

@app.get("/api/screener", response_model=ScreenerResponse)
def get_screener(
    rsi_min: Optional[float] = Query(None, ge=0, le=100),
    rsi_max: Optional[float] = Query(None, ge=0, le=100),
    above_sma50: Optional[bool] = Query(None),
    above_sma200: Optional[bool] = Query(None),
    within_high_pct: Optional[float] = Query(None, ge=0, le=100),
    change_min: Optional[float] = Query(None),
    change_max: Optional[float] = Query(None),
    price_min: Optional[float] = Query(None, ge=0),
    price_max: Optional[float] = Query(None, ge=0),
    momentum_1m_min: Optional[float] = Query(None),
    momentum_1m_max: Optional[float] = Query(None),
    volatility_min: Optional[float] = Query(None, ge=0, le=500),
    volatility_max: Optional[float] = Query(None, ge=0, le=500),
    rel_volume_min: Optional[float] = Query(None, ge=0),
    avg_volume_min: Optional[float] = Query(None, ge=0),
    sort_by: str = Query("symbol"),
    order: str = Query("asc"),
    limit: int = Query(50, ge=1, le=100),
):
    try:
        return screener.screen(
            rsi_min=rsi_min,
            rsi_max=rsi_max,
            above_sma50=above_sma50,
            above_sma200=above_sma200,
            within_high_pct=within_high_pct,
            change_min=change_min,
            change_max=change_max,
            price_min=price_min,
            price_max=price_max,
            momentum_1m_min=momentum_1m_min,
            momentum_1m_max=momentum_1m_max,
            volatility_min=volatility_min,
            volatility_max=volatility_max,
            rel_volume_min=rel_volume_min,
            avg_volume_min=avg_volume_min,
            sort_by=sort_by,
            order=order,
            limit=limit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Could not run screener: {exc}") from exc


# ---------- News sentiment ----------

@app.get("/api/news/market", response_model=NewsResponse)
def get_market_news(limit: int = Query(8, ge=1, le=20)):
    try:
        return news.market_news(limit)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Could not load market news: {exc}") from exc


@app.get("/api/news/{ticker}", response_model=NewsResponse)
def get_ticker_news(ticker: str, limit: int = Query(8, ge=1, le=20)):
    try:
        return news.ticker_news(ticker, limit)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Could not load news for '{ticker}': {exc}") from exc


# ---------- Backtest ----------

@app.get("/api/backtest", response_model=BacktestResponse)
def get_backtest(
    ticker: str = Query("SPY"),
    fast: int = Query(20, ge=2, le=250),
    slow: int = Query(50, ge=3, le=300),
    period: str = Query("5y"),
):
    _validate_period(period)
    try:
        return backtest.run_backtest(ticker, fast, slow, period)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Could not run backtest: {exc}") from exc
