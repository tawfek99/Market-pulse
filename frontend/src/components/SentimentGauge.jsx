// Composite sentiment panel: a headline score, a horizontal spectrum scale and
// a per-signal contribution row. Pure HTML/CSS (theme-aware via CSS variables)
// so it fills the card at any width instead of sitting in a fixed-size SVG.

function signalColor(score) {
  if (score >= 65) return "var(--bullish)";
  if (score >= 45) return "var(--neutral)";
  return "var(--bearish)";
}

export default function SentimentGauge({ data }) {
  const score = Math.max(0, Math.min(100, Math.round(data.score)));
  const color =
    data.category === "Bullish"
      ? "var(--bullish)"
      : data.category === "Bearish"
        ? "var(--bearish)"
        : "var(--neutral)";
  const components = data.components ?? [];

  return (
    <div className="sentiment">
      <div className="sentiment-headline">
        <div className="sentiment-value" style={{ color }}>
          {score}
          <span className="sentiment-value-unit">/100</span>
        </div>
        <div className="sentiment-headline-meta">
          <span className="sentiment-category" style={{ color }}>
            {data.category}
          </span>
          <span className="muted">Composite of four weighted signals</span>
        </div>
      </div>

      <div className="sentiment-scale">
        <div
          className="sentiment-track"
          role="img"
          aria-label={`Sentiment ${score} of 100, ${data.category}`}
        >
          {[25, 50, 75].map((tick) => (
            <span key={tick} className="sentiment-tick" style={{ left: `${tick}%` }} />
          ))}
          <span className="sentiment-marker" style={{ left: `${score}%` }} />
        </div>
        <div className="sentiment-zones">
          <span>Bearish</span>
          <span>Neutral</span>
          <span>Bullish</span>
        </div>
      </div>

      {components.length > 0 && (
        <div className="sentiment-signals">
          {components.map((c) => {
            const cColor = signalColor(c.score);
            return (
              <div className="sentiment-signal" key={c.name}>
                <div className="sentiment-signal-top">
                  <span
                    className="sentiment-signal-name"
                    title={`${Math.round(c.weight * 100)}% weight`}
                  >
                    {c.name}
                  </span>
                  <span className="sentiment-signal-score" style={{ color: cColor }}>
                    {Math.round(c.score)}
                  </span>
                </div>
                <span className="sentiment-signal-bar">
                  <span
                    className="sentiment-signal-fill"
                    style={{ width: `${c.score}%`, background: cColor }}
                  />
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
