/**
 * Numeric input with custom − / + stepper buttons. Native browser spinners
 * are hidden and replaced with fully theme-styled controls, so nothing turns
 * white on click in dark mode.
 *
 * `value` / `onChange` work with strings (matching text inputs); arrow keys
 * also step the value.
 */
export default function StepperInput({
  value,
  onChange,
  placeholder,
  min = 0,
  max,
  step = 1,
  className = "",
  ariaLabel,
}) {
  const adjust = (delta) => {
    const parsed = value === "" || value === undefined ? 0 : parseFloat(value);
    let next = (Number.isFinite(parsed) ? parsed : 0) + delta;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    next = Math.round(next * 1e6) / 1e6; // avoid float noise like 1.0000000001
    onChange(String(next));
  };

  return (
    <div className={`stepper ${className}`.trim()}>
      <button
        type="button"
        className="stepper-btn"
        tabIndex={-1}
        aria-label={`Decrease ${ariaLabel || "value"}`}
        onClick={() => adjust(-step)}
      >
        −
      </button>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            adjust(step);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            adjust(-step);
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
      <button
        type="button"
        className="stepper-btn"
        tabIndex={-1}
        aria-label={`Increase ${ariaLabel || "value"}`}
        onClick={() => adjust(step)}
      >
        +
      </button>
    </div>
  );
}
