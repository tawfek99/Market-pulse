import { formatPrice } from "../utils";

export default function MarketSummary({ data }) {
  return (
    <div className="summary">
      <div className="summary-grid">
        {data.indices.map((ix) => {
          const up = ix.change == null ? null : ix.change >= 0;
          const cls = up === null ? "flat" : up ? "up" : "down";
          const sign = up ? "+" : "";
          return (
            <div className="summary-item" key={ix.symbol}>
              <span className="summary-name" title={ix.symbol}>
                {ix.name}
              </span>
              <span className="summary-price">{formatPrice(ix.price)}</span>
              <span className={`summary-change ${cls}`}>
                {ix.change == null
                  ? "—"
                  : `${sign}${formatPrice(ix.change)} (${sign}${formatPrice(ix.change_pct)}%)`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
