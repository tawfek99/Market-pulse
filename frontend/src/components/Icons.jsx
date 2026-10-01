// Small, dependency-free line icons used across the shell. Kept as inline SVG
// (stroke = currentColor) so they stay crisp and inherit the surrounding color
// instead of relying on emoji glyphs.

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
};

export function SunIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function MoonIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

export function RefreshIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

export function StarIcon({ filled = false, ...props }) {
  return (
    <svg {...base} fill={filled ? "currentColor" : "none"} {...props}>
      <path d="M12 3.4l2.7 5.46 6.03.88-4.36 4.25 1.03 6L12 17.16 6.6 19.99l1.03-6L3.27 9.74l6.03-.88z" />
    </svg>
  );
}

export function AlertIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5L2.6 19.5h18.8z" />
      <path d="M12 10v4M12 17h.01" />
    </svg>
  );
}

export function SearchIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.6-3.6" />
    </svg>
  );
}

// Brand mark: a "pulse" line, matching the product name.
export function PulseMark(props) {
  return (
    <svg {...base} strokeWidth={2} {...props}>
      <path d="M2 12h3.5l2.5-6.5L12 18l2.5-6H22" />
    </svg>
  );
}
