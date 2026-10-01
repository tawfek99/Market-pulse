import { useRef } from "react";

function MoverCard({ m, dir, onSelect }) {
  return (
    <button
      type="button"
      className={`mover ${dir}`}
      onClick={() => onSelect(m.symbol)}
      title={m.name}
    >
      <span className="mover-symbol">{m.symbol}</span>
      <span className="mover-name">{m.name}</span>
      <span className="mover-change">
        {dir === "up" ? "+" : ""}
        {m.change_pct}%
      </span>
    </button>
  );
}

export default function MoversStrip({ data, onSelect }) {
  const scrollRef = useRef(null);

  const nudge = (dir) => {
    scrollRef.current?.scrollBy({ left: dir * 300, behavior: "smooth" });
  };

  return (
    <div className="movers-shell">
      <button
        type="button"
        className="movers-arrow movers-arrow-left"
        onClick={() => nudge(-1)}
        aria-label="Scroll left"
      >
        ‹
      </button>

      <div className="movers" ref={scrollRef}>
        {data.gainers.length > 0 && (
          <span className="movers-group-label up">▲ Gainers</span>
        )}
        {data.gainers.map((m) => (
          <MoverCard key={m.symbol} m={m} dir="up" onSelect={onSelect} />
        ))}

        {data.losers.length > 0 && (
          <span className="movers-group-label down">▼ Losers</span>
        )}
        {data.losers.map((m) => (
          <MoverCard key={m.symbol} m={m} dir="down" onSelect={onSelect} />
        ))}
      </div>

      <button
        type="button"
        className="movers-arrow movers-arrow-right"
        onClick={() => nudge(1)}
        aria-label="Scroll right"
      >
        ›
      </button>
    </div>
  );
}
