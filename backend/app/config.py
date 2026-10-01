"""Central configuration for the Market Pulse sentiment API."""

# How long (seconds) to cache fetched market data in memory before refetching.
CACHE_TTL_SECONDS = 60 * 30  # 30 minutes

# Shorter TTLs for search results and per-ticker metadata (fundamentals).
SEARCH_CACHE_TTL_SECONDS = 60 * 10  # 10 minutes
META_CACHE_TTL_SECONDS = 60 * 60  # 1 hour

# Broad, liquid large-cap tickers used as a proxy for overall market breadth.
# These power the "percentage of stocks above their 50-day average" signal.
BREADTH_TICKERS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK-B",
    "JPM", "V", "JNJ", "WMT", "PG", "UNH", "MA", "HD", "DIS", "BAC",
    "NFLX", "ADBE", "CRM", "XOM", "CVX", "KO", "PEP",
]

# Benchmark indices used for the market-level view.
MARKET_INDICES = {
    "sp500": "^GSPC",
    "nasdaq": "^IXIC",
    "dow": "^DJI",
    "vix": "^VIX",
}

# Composite sentiment score weights (must sum to 1.0).
WEIGHTS = {
    "volatility": 0.30,
    "breadth": 0.25,
    "trend": 0.25,
    "strength": 0.20,
}

# Score thresholds that map the composite score (0-100) to a category.
CATEGORY_THRESHOLDS = {
    "bullish": 65.0,
    "neutral": 45.0,
}

# Liquid tickers (symbol -> name) used to compute the daily movers strip.
# A curated, broad basket keeps the movers endpoint fast and reliable.
MOVERS_BASKET = {
    "AAPL": "Apple", "MSFT": "Microsoft", "GOOGL": "Alphabet", "AMZN": "Amazon",
    "NVDA": "NVIDIA", "META": "Meta", "TSLA": "Tesla", "BRK-B": "Berkshire Hathaway",
    "JPM": "JPMorgan Chase", "V": "Visa", "JNJ": "Johnson & Johnson", "WMT": "Walmart",
    "PG": "Procter & Gamble", "UNH": "UnitedHealth", "MA": "Mastercard", "HD": "Home Depot",
    "DIS": "Disney", "BAC": "Bank of America", "NFLX": "Netflix", "ADBE": "Adobe",
    "CRM": "Salesforce", "XOM": "Exxon Mobil", "CVX": "Chevron", "KO": "Coca-Cola",
    "PEP": "PepsiCo", "MRK": "Merck", "AVGO": "Broadcom", "COST": "Costco", "ORCL": "Oracle",
    "AMD": "AMD", "INTC": "Intel", "QCOM": "Qualcomm", "TXN": "Texas Instruments",
    "LLY": "Eli Lilly", "PFE": "Pfizer", "MCD": "McDonald's", "NKE": "Nike",
    "CAT": "Caterpillar", "BA": "Boeing", "GS": "Goldman Sachs", "MS": "Morgan Stanley",
    "IBM": "IBM", "VZ": "Verizon", "WFC": "Wells Fargo", "AXP": "American Express",
}
