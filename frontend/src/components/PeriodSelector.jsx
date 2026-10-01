const PERIODS = ["6mo", "1y", "2y", "5y"];

/** Segmented period control. `periods` may be strings or { value, label }. */
export default function PeriodSelector({ value, onChange, periods = PERIODS }) {
  return (
    <div className="segmented" role="tablist" aria-label="Time period">
      {periods.map((p) => {
        const val = typeof p === "string" ? p : p.value;
        const label = typeof p === "string" ? p : p.label;
        return (
          <button
            key={val}
            role="tab"
            aria-selected={value === val}
            className={`segment ${value === val ? "active" : ""}`}
            onClick={() => onChange(val)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
