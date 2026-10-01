export default function Watchlist({ items, onSelect, onRemove }) {
  if (!items.length) {
    return (
      <div className="watchlist-empty muted">
        Your watchlist is empty — search a ticker and pin it to track it here.
      </div>
    );
  }

  return (
    <div className="watchlist">
      {items.map((it) => (
        <button
          type="button"
          className="watchlist-pill"
          key={it.symbol}
          onClick={() => onSelect(it.symbol)}
          title={it.name || it.symbol}
        >
          <span className="wp-symbol">{it.symbol}</span>
          {it.name && <span className="wp-name">{it.name}</span>}
          <span
            className="wp-remove"
            role="button"
            aria-label={`Remove ${it.symbol}`}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(it.symbol);
            }}
          >
            ×
          </span>
        </button>
      ))}
    </div>
  );
}
