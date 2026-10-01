"""Pydantic response models for the API."""
from typing import Any, Optional

from pydantic import BaseModel, Field


class SentimentComponent(BaseModel):
    name: str
    description: str
    score: float
    weight: float
    detail: dict[str, Any]


class SentimentResponse(BaseModel):
    as_of: str
    score: float
    category: str
    summary: str
    components: list[SentimentComponent]


class HistoryPoint(BaseModel):
    date: str
    score: float
    category: str


class HistoryResponse(BaseModel):
    period: str
    points: list[HistoryPoint]


class IndexSummary(BaseModel):
    symbol: str
    name: str
    price: Optional[float]
    change: Optional[float]
    change_pct: Optional[float]


class MarketSummaryResponse(BaseModel):
    as_of: Optional[str]
    indices: list[IndexSummary]


class ChartPoint(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: Optional[float]


class ChartResponse(BaseModel):
    ticker: str
    period: str
    points: list[ChartPoint]


class SearchResult(BaseModel):
    symbol: str
    name: Optional[str]
    exchange: Optional[str]
    type: Optional[str]


class SearchResponse(BaseModel):
    results: list[SearchResult]


class TickerInfo(BaseModel):
    symbol: str
    name: str
    currency: Optional[str]
    price: Optional[float]
    change: Optional[float]
    change_pct: Optional[float]


class TickerStats(BaseModel):
    market_cap: Optional[float]
    pe_ratio: Optional[float]
    avg_volume: Optional[float]
    sma50: Optional[float]
    sma200: Optional[float]
    rsi14: Optional[float]
    fifty_two_week_high: Optional[float]
    fifty_two_week_low: Optional[float]


class TickerResponse(BaseModel):
    info: TickerInfo
    stats: TickerStats
    chart: list[ChartPoint]


class Mover(BaseModel):
    symbol: str
    name: str
    price: float
    change_pct: float


class MoversResponse(BaseModel):
    as_of: str
    gainers: list[Mover]
    losers: list[Mover]


# ---------- Portfolio ----------

class HoldingCreate(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)
    name: Optional[str] = None
    shares: float = Field(gt=0)
    cost_basis: float = Field(ge=0)


class HoldingUpdate(BaseModel):
    shares: Optional[float] = Field(None, gt=0)
    cost_basis: Optional[float] = Field(None, ge=0)


class HoldingOut(BaseModel):
    id: int
    symbol: str
    name: Optional[str]
    shares: float
    cost_basis: float
    price: Optional[float]
    value: Optional[float]
    cost_value: Optional[float]
    pnl: Optional[float]
    pnl_pct: Optional[float]
    day_change_pct: Optional[float]
    added_at: str


class PortfolioResponse(BaseModel):
    as_of: Optional[str]
    holdings: list[HoldingOut]
    total_value: Optional[float]
    total_cost: Optional[float]
    total_pnl: Optional[float]
    total_pnl_pct: Optional[float]


# ---------- Screener ----------

class ScreenerRow(BaseModel):
    symbol: str
    name: str
    price: Optional[float]
    change_pct: Optional[float]
    rsi14: Optional[float]
    above_sma50: Optional[bool]
    above_sma200: Optional[bool]
    pct_from_high: Optional[float]
    momentum_1m_pct: Optional[float]
    momentum_3m_pct: Optional[float]
    volatility_30d_pct: Optional[float]
    avg_volume_30d: Optional[float]
    rel_volume: Optional[float]


class ScreenerResponse(BaseModel):
    as_of: Optional[str]
    count: int
    results: list[ScreenerRow]


# ---------- News sentiment ----------

class NewsCounts(BaseModel):
    positive: int
    neutral: int
    negative: int


class NewsItem(BaseModel):
    title: str
    publisher: Optional[str]
    link: Optional[str]
    published: Optional[str]
    compound: float
    label: str


class NewsResponse(BaseModel):
    scope: str
    as_of: str
    score: float
    label: str
    counts: NewsCounts
    items: list[NewsItem]


# ---------- Backtest ----------

class BacktestMetrics(BaseModel):
    total_return_pct: Optional[float]
    cagr_pct: Optional[float]
    max_drawdown_pct: Optional[float]
    sharpe: Optional[float]
    volatility_pct: Optional[float]
    trades_count: Optional[int] = None
    win_rate_pct: Optional[float] = None


class BacktestTrade(BaseModel):
    entry_date: str
    exit_date: Optional[str]
    entry_price: float
    exit_price: Optional[float]
    return_pct: float
    days: int


class BacktestPoint(BaseModel):
    date: str
    strategy: float
    buy_hold: float


class BacktestResponse(BaseModel):
    ticker: str
    period: str
    fast: int
    slow: int
    as_of: str
    metrics: dict[str, BacktestMetrics]
    equity: list[BacktestPoint]
    trades: list[BacktestTrade]
