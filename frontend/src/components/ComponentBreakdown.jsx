import { CATEGORY_COLORS, formatKey, formatValue } from "../utils";

function scoreColor(score) {
  if (score >= 65) return CATEGORY_COLORS.Bullish;
  if (score >= 45) return CATEGORY_COLORS.Neutral;
  return CATEGORY_COLORS.Bearish;
}

export default function ComponentBreakdown({ components, summary }) {
  return (
    <div>
      <p className="summary-text">{summary}</p>
      <div className="breakdown-grid">
        {components.map((c) => {
          const color = scoreColor(c.score);
          return (
            <div className="component" key={c.name}>
              <div className="component-head">
                <span className="component-name">{c.name}</span>
                <span className="component-weight">
                  {Math.round(c.weight * 100)}% weight
                </span>
              </div>

              <div className="component-bar-row">
                <div className="component-bar">
                  <div
                    className="component-bar-fill"
                    style={{ width: `${c.score}%`, background: color }}
                  />
                </div>
                <span className="component-score" style={{ color }}>
                  {c.score}
                </span>
              </div>

              <p className="component-desc">{c.description}</p>

              <ul className="component-detail">
                {Object.entries(c.detail).map(([key, value]) => (
                  <li key={key}>
                    <span className="detail-key">{formatKey(key)}</span>
                    <span className="detail-val">{formatValue(value, key)}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
