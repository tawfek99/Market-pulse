// Node smoke test for the demo data layer. Runs the *real* `src/api/demo.js`
// against a built + previewed site, so it exercises the same snapshot files the
// browser would load.
//
//   npm run build            # with VITE_DEMO=1 (or default prod build)
//   npm run preview          # serves dist on :4173 (base path aware)
//   node scripts/test-demo.mjs
//
// Override the target with DEMO_BASE if your preview uses a different port/base.
globalThis.__MP_DEMO_BASE__ =
  process.env.DEMO_BASE || "http://localhost:4173/market-pulse/";

const demo = await import("../src/api/demo.js");

let passed = 0;
const failures = [];

function check(name, condition, extra = "") {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}${extra ? ` — ${extra}` : ""}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

console.log(`Testing demo layer against ${globalThis.__MP_DEMO_BASE__}\n`);

// ---- Market-wide ----------------------------------------------------------
const sentiment = await demo.fetchSentiment("1y");
check("sentiment score is a number", typeof sentiment.score === "number", `${sentiment.score} ${sentiment.category}`);
check("sentiment has 4 components", sentiment.components?.length === 4);
check("sentiment summary is a string", typeof sentiment.summary === "string");

const history = await demo.fetchHistory("2y");
check("history points present", history.points?.length > 0, `${history.points?.length} pts`);
check("history point shape", history.points?.[0]?.date && typeof history.points[0].score === "number");

const summary = await demo.fetchMarketSummary();
check("market summary has 4 indices", summary.indices?.length === 4);
check("index quotes present", summary.indices.every((i) => typeof i.price === "number"));

const movers = await demo.fetchMovers(5);
check("movers gainers <= 5", movers.gainers.length <= 5 && movers.gainers.length > 0, `${movers.gainers.length} up`);
check("movers losers <= 5", movers.losers.length <= 5 && movers.losers.length > 0, `${movers.losers.length} down`);

// ---- Charts ---------------------------------------------------------------
const daily = await demo.fetchChart("AAPL", "6mo", "1d");
check("6mo daily chart has points", daily.points.length > 100, `${daily.points.length} pts`);
check("chart point object shape", "open" in daily.points[0] && "close" in daily.points[0] && "volume" in daily.points[0]);

const intraday = await demo.fetchChart("AAPL", "1d", "5m");
check("1d chart uses intraday", intraday.points.length > 10, `${intraday.points.length} pts`);

const indexChart = await demo.fetchChart("^GSPC", "1y", "1d");
check("index chart resolves (^GSPC)", indexChart.points.length > 100, `${indexChart.points.length} pts`);

const maxChart = await demo.fetchChart("AAPL", "max", "1d");
check("max chart is long", maxChart.points.length > 2000, `${maxChart.points.length} pts`);

// ---- Ticker detail + search ----------------------------------------------
const ticker = await demo.fetchTicker("AAPL");
check("ticker info name", typeof ticker.info.name === "string", ticker.info.name);
check("ticker stats present", typeof ticker.stats.rsi14 === "number" && typeof ticker.stats.sma50 === "number");

const search = await demo.searchTickers("app", 6);
check("search finds AAPL", search.results.some((r) => r.symbol === "AAPL"), search.results.map((r) => r.symbol).join(","));
const searchByName = await demo.searchTickers("nvidia", 6);
check("search by name finds NVDA", searchByName.results.some((r) => r.symbol === "NVDA"));

// ---- News -----------------------------------------------------------------
const marketNews = await demo.fetchNews("market", 8);
check("market news has items", marketNews.items.length === 8);
const aaplNews = await demo.fetchNews("AAPL", 8);
check("ticker news has items", aaplNews.items.length > 0, `${aaplNews.items.length} items`);
const fallbackNews = await demo.fetchNews("KO", 8);
check("uncaptured ticker falls back to market news", fallbackNews.items.length > 0);

// ---- Screener (client-side filter/sort parity) ----------------------------
const all = await demo.fetchScreener({});
check("screener returns full universe", all.count === 45, `${all.count} rows`);

const oversold = await demo.fetchScreener({ rsi_max: "30" });
check("rsi_max filter only keeps rsi<=30", oversold.results.every((r) => r.rsi14 !== null && r.rsi14 <= 30), `${oversold.count} matches`);

const sorted = await demo.fetchScreener({ sort_by: "change_pct", order: "desc" });
const chg = sorted.results.map((r) => r.change_pct);
check("sort desc by change_pct is ordered", chg.every((v, i) => i === 0 || chg[i - 1] >= v));

const above200 = await demo.fetchScreener({ above_sma200: true });
check("above_sma200 filter works", above200.results.every((r) => r.above_sma200 === true), `${above200.count} matches`);

// ---- Backtest (client-side parity) ---------------------------------------
const bt = await demo.fetchBacktest({ ticker: "AAPL", fast: 20, slow: 50, period: "5y" });
check("backtest metrics finite", Number.isFinite(bt.metrics.strategy.total_return_pct) && Number.isFinite(bt.metrics.buy_hold.total_return_pct), `strat ${bt.metrics.strategy.total_return_pct}% vs bh ${bt.metrics.buy_hold.total_return_pct}%`);
check("backtest equity length matches trades span", bt.equity.length > 1000, `${bt.equity.length} pts`);
check("backtest equity starts at 100", bt.equity[0].strategy === 100 && bt.equity[0].buy_hold === 100);
check("backtest produced trades", bt.trades.length > 0, `${bt.trades.length} trades`);
check("backtest win rate in range", bt.metrics.strategy.win_rate_pct >= 0 && bt.metrics.strategy.win_rate_pct <= 100);

let threw = false;
try {
  await demo.fetchBacktest({ ticker: "AAPL", fast: 50, slow: 20, period: "5y" });
} catch {
  threw = true;
}
check("backtest rejects fast >= slow", threw);

// ---- Portfolio (localStorage) --------------------------------------------
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const empty = await demo.fetchPortfolio();
check("portfolio starts empty", empty.holdings.length === 0);

await demo.addHolding({ symbol: "AAPL", name: "Apple", shares: 10, cost_basis: 100 });
const one = await demo.fetchPortfolio();
check("portfolio add works", one.holdings.length === 1 && one.holdings[0].value !== null, `value ${one.holdings[0].value}`);

let dupThrew = false;
try {
  await demo.addHolding({ symbol: "AAPL", shares: 1, cost_basis: 1 });
} catch {
  dupThrew = true;
}
check("portfolio rejects duplicate symbol", dupThrew);

await demo.updateHolding(one.holdings[0].id, { shares: 20 });
const two = await demo.fetchPortfolio();
check("portfolio update works", two.holdings[0].shares === 20);

await demo.deleteHolding(one.holdings[0].id);
check("portfolio delete works", (await demo.fetchPortfolio()).holdings.length === 0);

// ---- Report ---------------------------------------------------------------
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("Failed: " + failures.join(", "));
  process.exit(1);
}
