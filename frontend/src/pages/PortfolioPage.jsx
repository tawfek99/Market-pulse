import PageHead from "../components/PageHead";
import Portfolio from "../components/Portfolio";

export default function PortfolioPage({ refreshKey, onSelect }) {
  return (
    <>
      <PageHead
        title="Portfolio"
        subtitle="Track holdings with live prices. Positions persist in SQLite on the backend."
      />
      <section className="card">
        <Portfolio refreshKey={refreshKey} onSelect={onSelect} />
      </section>
    </>
  );
}
