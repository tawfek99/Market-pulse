import json
import traceback

import yfinance as yf

print("yfinance", yf.__version__)


def try_search():
    try:
        from yfinance import Search
        s = Search("apple", max_results=5)
        quotes = s.quotes
        print("SEARCH OK, count:", len(quotes))
        for q in quotes[:3]:
            print("  ", {k: q.get(k) for k in ("symbol", "shortname", "longname", "exchDisp", "quoteType", "typeDisp")})
    except Exception as e:
        print("SEARCH FAIL:", repr(e))
        traceback.print_exc()


def try_info():
    try:
        t = yf.Ticker("AAPL")
        info = t.info
        keys = ["symbol", "shortName", "longName", "regularMarketPrice", "regularMarketChange",
                "regularMarketChangePercent", "marketCap", "trailingPE", "fiftyTwoWeekHigh",
                "fiftyTwoWeekLow", "volume", "averageVolume", "currency", "quoteType"]
        print("INFO OK")
        print("  ", json.dumps({k: info.get(k) for k in keys}, default=str))
    except Exception as e:
        print("INFO FAIL:", repr(e))
        traceback.print_exc()


def try_screener():
    try:
        s = yf.Screener(body="day_gainers")
        resp = s.response
        quotes = resp.get("quotes", []) if isinstance(resp, dict) else []
        print("SCREENER OK, count:", len(quotes))
        for q in quotes[:2]:
            print("  ", {k: q.get(k) for k in ("symbol", "shortName", "regularMarketChangePercent", "regularMarketPrice")})
    except Exception as e:
        print("SCREENER FAIL:", repr(e))
        traceback.print_exc()


try_search()
print("---")
try_info()
print("---")
try_screener()
