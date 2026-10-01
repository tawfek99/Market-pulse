import PageHead from "../components/PageHead";
import Portfolio from "../components/Portfolio";

export default function PortfolioPage({ refreshKey, onSelect }) {
  return (
    <>
      <PageHead
        title="Portfolio"
        subtitle="Track holdings with current prices and live P&L."
      />
      <section className="card">
        <Portfolio refreshKey={refreshKey} onSelect={onSelect} />
      </section>
    </>
  );
}
