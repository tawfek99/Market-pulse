"""Headline-based news sentiment scoring.

Fetches recent headlines from Yahoo Finance and scores them with VADER, a
well-known lexicon + rule-based sentiment analyzer. Per-headline compound
scores are blended into a 0-100 aggregate with recency weighting (a 24-hour
half-life) so fresh headlines dominate, then mapped to the same
Bullish / Neutral / Bearish buckets used across the app.

Transparent by design: every number traces back to a specific headline.
"""
from datetime import datetime, timezone

import yfinance as yf
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from . import config, data

NEWS_CACHE_TTL_SECONDS = 60 * 10  # 10 minutes

# Market-wide news is proxied by a couple of broad search queries. The
# yfinance `Search` API returns recent headlines for a given query.
MARKET_SOURCES = ["stock market", "S&P 500", "SPY"]

_analyzer = SentimentIntensityAnalyzer()

# VADER knows general language well but underweights common financial
# phrasing. This small, transparent domain lexicon tunes the headline scores
# (values on VADER's -4..+4 scale; negations/boosters still apply).
_FINANCE_LEXICON = {
    "beats": 1.8, "beat": 1.4, "surges": 2.6, "surge": 2.2, "soars": 3.0,
    "soar": 2.6, "jumps": 2.2, "jump": 1.8, "rallies": 2.0, "rally": 1.8,
    "record": 1.4, "highs": 1.5, "upgrade": 2.2, "upgraded": 2.2,
    "upgrades": 2.2, "outperform": 1.8, "gains": 1.2, "gain": 1.0,
    "climbs": 1.6, "boost": 1.4, "boosts": 1.5, "strong": 1.6,
    "growth": 1.2, "profit": 1.6, "bullish": 1.6, "buyback": 1.4,
    "sinks": -2.6, "sink": -1.8, "plunges": -3.2, "plunge": -3.0,
    "tumbles": -2.8, "tumble": -2.6, "slides": -2.0, "slide": -1.8,
    "slumps": -2.6, "slump": -2.2, "downgrade": -2.4, "downgraded": -2.4,
    "downgrades": -2.4, "misses": -2.0, "miss": -1.2, "loss": -1.6,
    "losses": -1.8, "layoffs": -2.6, "layoff": -2.2, "cuts": -1.6,
    "recall": -2.2, "recalls": -2.4, "lawsuit": -2.2, "probe": -1.6,
    "investigation": -1.6, "drops": -1.4, "drop": -1.0, "falls": -1.6,
    "fall": -1.2, "declines": -1.8, "decline": -1.6, "warns": -1.8,
    "warning": -1.6, "weak": -1.8, "bankruptcy": -3.6, "recession": -2.2,
    "fears": -1.4, "crash": -3.0, "selloff": -2.6, "sell-off": -2.6,
    "shortage": -1.2, "bearish": -1.6,
}
_analyzer.lexicon.update(_FINANCE_LEXICON)

_POSITIVE = 0.05
_NEGATIVE = -0.05


def _label(compound: float) -> str:
    if compound >= _POSITIVE:
        return "Positive"
    if compound <= _NEGATIVE:
        return "Negative"
    return "Neutral"


def _aggregate_label(score: float) -> str:
    if score >= config.CATEGORY_THRESHOLDS["bullish"]:
        return "Bullish"
    if score >= config.CATEGORY_THRESHOLDS["neutral"]:
        return "Neutral"
    return "Bearish"


def _fetch_items(query: str, limit: int = 10) -> list[dict]:
    """Pull headlines for a query via yfinance's Search API and score them."""
    try:
        raw = yf.Search(query, news_count=limit).news or []
    except Exception:  # noqa: BLE001 - news is best-effort
        raw = []

    items = []
    for story in raw:
        if not isinstance(story, dict):
            continue
        title = (story.get("title") or "").strip()
        if not title:
            continue
        compound = _analyzer.polarity_scores(title)["compound"]

        # Structure varies across yfinance versions: handle both.
        publisher = story.get("publisher")
        if isinstance(publisher, dict):
            publisher = publisher.get("displayName")

        link = story.get("link") or story.get("clickThroughUrl") or story.get("canonicalUrl")
        if isinstance(link, dict):
            link = link.get("url")

        published = None
        raw_date = story.get("providerPublishTime") or story.get("pubDate")
        if isinstance(raw_date, (int, float)):
            try:
                published = datetime.fromtimestamp(raw_date, tz=timezone.utc).isoformat()
            except (TypeError, ValueError, OSError):
                published = None
        elif isinstance(raw_date, str):
            try:
                published = datetime.fromisoformat(raw_date.replace("Z", "+00:00")).isoformat()
            except ValueError:
                published = None

        items.append(
            {
                "title": title,
                "publisher": publisher,
                "link": link,
                "published": published,
                "compound": round(compound, 3),
                "label": _label(compound),
            }
        )
    return items


def _blend(items: list[dict]) -> dict:
    """Blend headline compounds into a recency-weighted 0-100 score."""
    now = datetime.now(timezone.utc)
    weighted_sum = 0.0
    weight_total = 0.0
    counts = {"positive": 0, "neutral": 0, "negative": 0}

    for item in items:
        counts[item["label"].lower()] += 1

        age_hours = 24.0
        if item["published"]:
            try:
                published = datetime.fromisoformat(item["published"])
                age_hours = max(0.0, (now - published).total_seconds() / 3600.0)
            except ValueError:
                pass
        weight = 2 ** (-age_hours / 24.0)  # half-life of 24 hours

        weighted_sum += item["compound"] * weight
        weight_total += weight

    mean = weighted_sum / weight_total if weight_total else 0.0
    score = round((mean + 1.0) / 2.0 * 100.0, 1)
    return {"score": score, "label": _aggregate_label(score), "counts": counts}


def ticker_news(ticker: str, limit: int = 8) -> dict:
    """News sentiment for a single ticker."""
    symbol = ticker.upper().strip()

    def _run():
        items = _fetch_items(symbol, max(limit, 10))
        items.sort(key=lambda i: i["published"] or "", reverse=True)
        top = items[:limit]
        return {
            "scope": symbol,
            "as_of": datetime.now(timezone.utc).isoformat(),
            **_blend(top),
            "items": top,
        }

    return data._cache_get_or_set(("news", symbol, limit), NEWS_CACHE_TTL_SECONDS, _run)


def market_news(limit: int = 8) -> dict:
    """Market-wide news sentiment from broad ETF/index headlines."""

    def _run():
        items = []
        seen = set()
        for source in MARKET_SOURCES:
            for item in _fetch_items(source, max(limit, 10)):
                key = item["title"].lower()
                if key in seen:
                    continue
                seen.add(key)
                items.append(item)
            if len(items) >= limit + 5:
                break

        items.sort(key=lambda i: i["published"] or "", reverse=True)
        top = items[:limit]
        return {
            "scope": "market",
            "as_of": datetime.now(timezone.utc).isoformat(),
            **_blend(top),
            "items": top,
        }

    return data._cache_get_or_set(("news", "market", limit), NEWS_CACHE_TTL_SECONDS, _run)
