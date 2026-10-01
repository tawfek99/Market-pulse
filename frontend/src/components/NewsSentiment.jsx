import { timeAgo } from "../utils";

function labelColor(label) {
  if (label === "Bullish") return "var(--bullish)";
  if (label === "Bearish") return "var(--bearish)";
  return "var(--neutral)";
}

function itemClass(label) {
  return label === "Positive" ? "pos" : label === "Negative" ? "neg" : "neu";
}

/**
 * Aggregate news sentiment + the scored headlines behind it. The aggregate
 * score is a recency-weighted blend of VADER compound scores on a 0-100
 * scale, so every number traces back to a visible headline.
 */
export default function NewsSentiment({ data }) {
  const { counts = {} } = data;
  const color = labelColor(data.label);

  return (
    <div className="news">
      <div className="news-summary">
        <div className="news-score" style={{ color }}>
          {data.score}
        </div>
        <div className="news-meta">
          <span className="news-label" style={{ color }}>
            {data.label}
          </span>
          <span className="muted">VADER headline sentiment</span>
          <span className="news-counts">
            <span className="up">▲ {counts.positive}</span>
            <span className="muted">■ {counts.neutral}</span>
            <span className="down">▼ {counts.negative}</span>
          </span>
        </div>
        <div className="news-bar">
          <div className="news-bar-fill" style={{ width: `${data.score}%`, background: color }} />
        </div>
      </div>

      {data.items.length === 0 ? (
        <p className="muted">No recent headlines found.</p>
      ) : (
        <ul className="news-list">
          {data.items.map((item) => (
            <li key={item.title} className="news-item">
              <span className={`news-dot ${itemClass(item.label)}`} title={item.label} />
              <div className="news-item-body">
                <a
                  className="news-title"
                  href={item.link || undefined}
                  target="_blank"
                  rel="noreferrer"
                  title={item.title}
                >
                  {item.title}
                </a>
                <span className="news-pub muted">
                  {item.publisher && <>{item.publisher} · </>}
                  {timeAgo(item.published)} · {item.label}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
