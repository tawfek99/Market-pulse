import PageHead from "../components/PageHead";
import Screener from "../components/Screener";

export default function ScreenerPage({ refreshKey, onSelect }) {
  return (
    <>
      <PageHead
        title="Stock Screener"
        subtitle="Filter a 45-name liquid universe by RSI, moving averages, and distance from 52-week highs."
      />
      <section className="card">
        <Screener refreshKey={refreshKey} onSelect={onSelect} />
      </section>
    </>
  );
}
