import { useEffect, useMemo, useRef, useState } from "react";
import { formatLarge, formatPrice, formatShortDate } from "../utils";
import useMediaQuery from "../hooks/useMediaQuery";

const OVERLAY_COLORS = {
  sma20: "var(--chart-sma20)",
  sma50: "var(--chart-sma50)",
  bollinger: "var(--chart-bollinger)",
};

const OVERLAY_LABELS = {
  sma20: "SMA 20",
  sma50: "SMA 50",
  bollinger: "Bollinger",
};

const PAD_LEFT = 58;
const PAD_RIGHT = 16;

function useWidth(ref) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

/** Simple moving average over a value array (nulls preserved for the warm-up). */
function smaSeries(values, window) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    if (i >= window - 1) out[i] = sum / window;
  }
  return out;
}

/** Bollinger bands (middle = SMA20, ±2 standard deviations). */
function bollingerSeries(values, window = 20, mult = 2) {
  const middle = smaSeries(values, window);
  const upper = new Array(values.length).fill(null);
  const lower = new Array(values.length).fill(null);
  for (let i = window - 1; i < values.length; i++) {
    const slice = values.slice(i - window + 1, i + 1);
    const mean = middle[i];
    const variance = slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / window;
    const sd = Math.sqrt(variance);
    upper[i] = mean + mult * sd;
    lower[i] = mean - mult * sd;
  }
  return { middle, upper, lower };
}

function timeLabel(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/**
 * Dependency-free candlestick + volume chart with SMA / Bollinger overlays,
 * smooth wheel zoom, drag panning, double-click reset, and a TradingView-style
 * range navigator strip. `data` is an array of
 * { date, open, high, low, close, volume }.
 */
export default function CandlestickChart({ data, height = 420, defaultOverlays }) {
  const containerRef = useRef(null);
  const width = useWidth(containerRef);
  const isNarrow = useMediaQuery("(max-width: 640px)");
  // Shorter chart on phones so it doesn't dominate the screen, and a tighter
  // left gutter so the candles get more horizontal room.
  const chartHeight = isNarrow ? Math.min(height, 340) : height;
  const padLeft = isNarrow ? 44 : PAD_LEFT;
  const [hover, setHover] = useState(null);
  const [overlays, setOverlays] = useState(
    defaultOverlays ?? { sma20: true, sma50: true, bollinger: false }
  );
  const [view, setView] = useState(null); // { s, e } fractional bar coords; null = full
  const [dragging, setDragging] = useState(null);
  // Active pointers (for pinch-to-zoom), the pinch baseline, and the pending
  // tooltip auto-hide timer.
  const pointers = useRef(new Map());
  const pinch = useRef(null);
  const hideTimer = useRef(null);
  const lastTouchAt = useRef(0);

  // Touch has no "leave" event, so hide the tooltip a moment after the finger is
  // lifted. A new touch or drag cancels the pending hide.
  const clearHide = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };
  const scheduleHide = () => {
    clearHide();
    hideTimer.current = setTimeout(() => setHover(null), 1000);
  };

  const n = data.length;
  const minWin = Math.max(3, Math.min(10, n - 1));

  // Reset the viewport when the dataset changes.
  useEffect(() => {
    setView(null);
    setHover(null);
    setDragging(null);
  }, [data]);

  // Clear any pending tooltip auto-hide timer on unmount.
  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    []
  );

  // Fallback: if a touch ends outside the plot, or the browser cancels the
  // gesture, still dismiss the tooltip shortly after release.
  useEffect(() => {
    const onUpAnywhere = (e) => {
      if (e.pointerType === "mouse") return;
      lastTouchAt.current = Date.now();
      const had = pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
      if (had) {
        setDragging(null);
        scheduleHide();
      }
    };
    window.addEventListener("pointerup", onUpAnywhere);
    window.addEventListener("pointercancel", onUpAnywhere);
    return () => {
      window.removeEventListener("pointerup", onUpAnywhere);
      window.removeEventListener("pointercancel", onUpAnywhere);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vs = view ? view.s : 0;
  const ve = view ? view.e : n;
  const i0 = Math.max(0, Math.floor(vs));
  const i1 = Math.min(n - 1, Math.ceil(ve) - 1);

  const series = useMemo(() => {
    const closes = data.map((d) => d.close);
    return {
      sma20: smaSeries(closes, 20),
      sma50: smaSeries(closes, 50),
      ...bollingerSeries(closes, 20, 2),
    };
  }, [data]);

  const closes = useMemo(() => data.map((d) => d.close), [data]);

  const zoomAt = (f, factor) => {
    setView((current) => {
      const span = current ? current.e - current.s : n;
      let newSpan = span * factor;
      if (newSpan >= n * 0.999) return null;
      if (newSpan < minWin) newSpan = minWin;
      let s = (current ? current.s : 0) + (span - newSpan) * f;
      s = Math.max(0, Math.min(n - newSpan, s));
      return { s, e: s + newSpan };
    });
  };

  // Native wheel listener (non-passive) so preventDefault actually works.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const plotW = rect.width - padLeft - PAD_RIGHT;
      if (plotW <= 0) return;
      const f = Math.max(0, Math.min(1, (e.clientX - rect.left - padLeft) / plotW));
      zoomAt(f, e.deltaY > 0 ? 1.2 : 1 / 1.2);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, n, minWin, padLeft]);

  const geo = useMemo(() => {
    if (!width || !n) return null;

    const padTop = isNarrow ? 10 : 12;
    const padBottom = 24;
    const volHeight = isNarrow ? 46 : 64;
    const volGap = isNarrow ? 6 : 8;
    const navGap = isNarrow ? 10 : 12;
    const navH = isNarrow ? 46 : 52;

    const priceTop = padTop;
    const priceBottom = chartHeight - padBottom - navH - navGap - volHeight - volGap;
    const volTop = priceBottom + volGap;
    const volBottom = volTop + volHeight;
    const navTop = volBottom + navGap;
    const navBottom = navTop + navH;

    let minP = Infinity;
    let maxP = -Infinity;
    for (let i = i0; i <= i1; i++) {
      minP = Math.min(minP, data[i].low);
      maxP = Math.max(maxP, data[i].high);
    }
    const include = (arr) => {
      for (let i = i0; i <= i1; i++) {
        const v = arr[i];
        if (v != null) {
          minP = Math.min(minP, v);
          maxP = Math.max(maxP, v);
        }
      }
    };
    if (overlays.sma20) include(series.sma20);
    if (overlays.sma50) include(series.sma50);
    if (overlays.bollinger) {
      include(series.upper);
      include(series.lower);
    }
    if (!Number.isFinite(minP)) {
      minP = 0;
      maxP = 1;
    }
    if (minP === maxP) {
      minP -= 1;
      maxP += 1;
    }
    const padP = (maxP - minP) * 0.05;
    minP -= padP;
    maxP += padP;

    const plotW = width - padLeft - PAD_RIGHT;
    const count = i1 - i0 + 1;

    // Raw per-row scale: one x-position per data row. Used for the crosshair,
    // the overlay lines, date ticks and hover hit-testing.
    const step = plotW / count;
    const x = (i) => padLeft + (i - i0 + 0.5) * step;

    // Aggregate rows into buckets whenever a single row would be thinner than
    // ~2px. A long range (Max can exceed 11,000 daily rows) otherwise draws
    // tens of thousands of sub-pixel candlesticks that read as noise and make
    // every hover re-render janky.
    const maxBars = Math.max(1, Math.floor(plotW / 2));
    const bucket = Math.max(1, Math.ceil(count / maxBars));
    const bars = [];
    for (let s = i0; s <= i1; s += bucket) {
      const e = Math.min(i1, s + bucket - 1);
      let high = -Infinity;
      let low = Infinity;
      let volume = 0;
      for (let i = s; i <= e; i++) {
        if (data[i].high > high) high = data[i].high;
        if (data[i].low < low) low = data[i].low;
        volume += data[i].volume || 0;
      }
      bars.push({
        start: s,
        end: e,
        date: data[e].date,
        open: data[s].open,
        close: data[e].close,
        high,
        low,
        volume,
      });
    }
    const barCount = bars.length;
    const barStep = plotW / barCount;
    const candleW = Math.max(1, Math.min(barStep * 0.62, 14));
    const barX = (bi) => padLeft + (bi + 0.5) * barStep;

    let volMax = 1;
    for (const b of bars) if (b.volume > volMax) volMax = b.volume;

    const y = (p) => priceTop + ((maxP - p) / (maxP - minP)) * (priceBottom - priceTop);
    const volY = (v) => volBottom - (v / volMax) * volHeight;

    return {
      width,
      height: chartHeight,
      padLeft,
      padRight: PAD_RIGHT,
      priceTop,
      priceBottom,
      volTop,
      volBottom,
      navTop,
      navBottom,
      minP,
      maxP,
      plotW,
      step,
      x,
      bars,
      barCount,
      barStep,
      barX,
      candleW,
      y,
      volY,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, chartHeight, isNarrow, padLeft, data, series, overlays, i0, i1]);

  const gridLevels = useMemo(() => {
    if (!geo) return [];
    const levels = [];
    for (let i = 0; i <= 4; i++) {
      const p = geo.minP + (geo.maxP - geo.minP) * (i / 4);
      levels.push({ p, y: geo.y(p) });
    }
    return levels;
  }, [geo]);

  const dateTicks = useMemo(() => {
    if (!geo) return [];
    const count = Math.max(2, Math.min(6, Math.floor(geo.plotW / 100)));
    const ticks = [];
    for (let k = 0; k <= count; k++) {
      const i = i0 + Math.round((k / count) * (i1 - i0));
      ticks.push({ i, x: geo.x(i) });
    }
    return ticks;
  }, [geo, i0, i1]);

  const polyline = (values) => {
    if (!geo) return null;
    const pts = [];
    for (let i = Math.max(0, i0 - 1); i <= i1; i++) {
      const v = values[i];
      if (v != null) pts.push(`${geo.x(i).toFixed(1)},${geo.y(v).toFixed(1)}`);
    }
    return pts.length ? pts.join(" ") : null;
  };

  // The layers below don't depend on the hover state, so memoise them: moving
  // the mouse then only re-renders the crosshair + tooltip instead of every
  // candle, volume bar, overlay path and the navigator.
  const candleLayer = useMemo(() => {
    if (!geo) return null;
    return geo.bars.map((b, bi) => {
      const color = b.close >= b.open ? "var(--up)" : "var(--down)";
      const bodyTop = geo.y(Math.max(b.open, b.close));
      const bodyH = Math.max(1, Math.abs(geo.y(b.open) - geo.y(b.close)));
      return (
        <g key={bi}>
          <line
            x1={geo.barX(bi)}
            x2={geo.barX(bi)}
            y1={geo.y(b.high)}
            y2={geo.y(b.low)}
            style={{ stroke: color }}
            strokeWidth="1"
          />
          <rect
            x={geo.barX(bi) - geo.candleW / 2}
            y={bodyTop}
            width={geo.candleW}
            height={bodyH}
            style={{ fill: color }}
          />
        </g>
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo]);

  const volumeLayer = useMemo(() => {
    if (!geo) return null;
    return geo.bars.map((b, bi) => {
      const color = b.close >= b.open ? "var(--up)" : "var(--down)";
      const yv = geo.volY(b.volume);
      return (
        <rect
          key={bi}
          x={geo.barX(bi) - geo.candleW / 2}
          y={yv}
          width={geo.candleW}
          height={geo.volBottom - yv}
          style={{ fill: color }}
          opacity={0.45}
        />
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo]);

  const navPath = useMemo(() => {
    if (!geo) return "";
    let min = Infinity;
    let max = -Infinity;
    for (const c of closes) {
      if (c < min) min = c;
      if (c > max) max = c;
    }
    const span = max - min || 1;
    const navH = geo.navBottom - geo.navTop - 8;
    return closes
      .map((c, i) => {
        const px = geo.padLeft + (i / Math.max(1, n - 1)) * geo.plotW;
        const py = geo.navTop + 4 + (1 - (c - min) / span) * navH;
        return `${px.toFixed(1)},${py.toFixed(1)}`;
      })
      .join(" ");
  }, [geo, closes, n]);

  const sma20Path = useMemo(() => polyline(series.sma20), [geo, series]); // eslint-disable-line react-hooks/exhaustive-deps
  const sma50Path = useMemo(() => polyline(series.sma50), [geo, series]); // eslint-disable-line react-hooks/exhaustive-deps
  const bollUpper = useMemo(() => polyline(series.upper), [geo, series]); // eslint-disable-line react-hooks/exhaustive-deps
  const bollLower = useMemo(() => polyline(series.lower), [geo, series]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key) => setOverlays((o) => ({ ...o, [key]: !o[key] }));

  if (!geo) {
    return (
      <div className="candle-wrap">
        <div ref={containerRef} style={{ height: chartHeight }} />
      </div>
    );
  }

  const indexAt = (clientX, el) => {
    const rect = el.getBoundingClientRect();
    const px = clientX - rect.left;
    return Math.max(i0, Math.min(i1, i0 + Math.floor((px - geo.padLeft) / geo.step)));
  };

  const setHoverAt = (clientX, el) => {
    const i = indexAt(clientX, el);
    setHover((prev) => (prev === i ? prev : i));
  };

  const onMove = (e) => {
    // Ignore the synthetic mouse events mobile browsers emit after a tap, which
    // would otherwise immediately re-show the tooltip we just hid.
    if (dragging || Date.now() - lastTouchAt.current < 800) return;
    setHoverAt(e.clientX, e.currentTarget);
  };

  // ---------- main chart: tap/hover for the tooltip, drag to pan (when
  // zoomed), pinch to zoom ----------
  const onPointerDown = (e) => {
    pointers.current.set(e.pointerId, e.clientX);
    // Touch has no hover: show the tooltip on tap.
    if (e.pointerType !== "mouse") {
      lastTouchAt.current = Date.now();
      clearHide();
      setHoverAt(e.clientX, e.currentTarget);
      // Capture so we still receive pointerup even if the finger leaves the plot.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // capture is best-effort
      }
    }

    // A second finger switches from pan/tap into pinch-to-zoom.
    if (pointers.current.size === 2) {
      const xs = [...pointers.current.values()];
      pinch.current = { dist: Math.abs(xs[0] - xs[1]), view: view ?? { s: 0, e: n } };
      setHover(null);
      setDragging(null);
      return;
    }
    if (!view) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // capture is best-effort
    }
    setDragging({
      area: "chart",
      startClientX: e.clientX,
      startS: view.s,
      startE: view.e,
      plotW: geo.plotW,
    });
  };

  const onChartPointerMove = (e) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, e.clientX);

    // Pinch: scale the baseline span about the midpoint between the fingers.
    if (pinch.current && pointers.current.size >= 2) {
      const xs = [...pointers.current.values()];
      const dist = Math.abs(xs[0] - xs[1]);
      if (pinch.current.dist > 0 && dist > 0) {
        const rect = e.currentTarget.getBoundingClientRect();
        const mid = (xs[0] + xs[1]) / 2 - rect.left;
        const f = Math.max(0, Math.min(1, (mid - geo.padLeft) / geo.plotW));
        const base = pinch.current.view;
        const baseSpan = base.e - base.s;
        let newSpan = baseSpan * (pinch.current.dist / dist);
        newSpan = Math.max(minWin, Math.min(n, newSpan));
        if (newSpan >= n * 0.999) {
          setView(null);
        } else {
          const s = Math.max(0, Math.min(n - newSpan, base.s + (baseSpan - newSpan) * f));
          setView({ s, e: s + newSpan });
        }
      }
      return;
    }

    if (e.pointerType !== "mouse" && (!dragging || dragging.area !== "chart")) {
      clearHide();
      setHoverAt(e.clientX, e.currentTarget);
      return;
    }
    if (!dragging || dragging.area !== "chart") return;
    const span = dragging.startE - dragging.startS;
    const barsPerPx = span / dragging.plotW;
    const ds = (e.clientX - dragging.startClientX) * barsPerPx;
    const s = Math.max(0, Math.min(n - span, dragging.startS - ds));
    setView({ s, e: s + span });
  };

  // ---------- navigator: pan / resize / jump ----------
  const navWindow = {
    xs: geo.padLeft + (vs / n) * geo.plotW,
    xe: geo.padLeft + (ve / n) * geo.plotW,
  };
  // Wider handles and a more forgiving grab zone on touch screens.
  const handleW = isNarrow ? 12 : 6;
  const nearPx = isNarrow ? 20 : 8;

  const onNavPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const span = ve - vs;
    const near = (a, b) => Math.abs(a - b) <= nearPx;

    if (near(px, navWindow.xs)) {
      setDragging({ area: "nav", mode: "resize-l", startClientX: e.clientX, startS: vs, startE: ve });
    } else if (near(px, navWindow.xe)) {
      setDragging({ area: "nav", mode: "resize-r", startClientX: e.clientX, startS: vs, startE: ve });
    } else if (px >= navWindow.xs && px <= navWindow.xe) {
      setDragging({ area: "nav", mode: "pan", startClientX: e.clientX, startS: vs, startE: ve });
    } else {
      const idx = Math.max(0, Math.min(1, (px - geo.padLeft) / geo.plotW)) * n;
      const s = Math.max(0, Math.min(n - span, idx - span / 2));
      setView({ s, e: s + span });
    }
  };

  const onNavPointerMove = (e) => {
    if (!dragging || dragging.area !== "nav") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const idx = Math.max(0, Math.min(1, (px - geo.padLeft) / geo.plotW)) * n;

    if (dragging.mode === "pan") {
      const barsPerPx = n / geo.plotW;
      const ds = (e.clientX - dragging.startClientX) * barsPerPx;
      const span = dragging.startE - dragging.startS;
      const s = Math.max(0, Math.min(n - span, dragging.startS + ds));
      setView({ s, e: s + span });
    } else if (dragging.mode === "resize-l") {
      const s = Math.max(0, Math.min(dragging.startE - minWin, idx));
      setView({ s, e: Math.max(dragging.startE, s + minWin) });
    } else if (dragging.mode === "resize-r") {
      const e = Math.min(n, Math.max(dragging.startS + minWin, idx));
      setView({ s: Math.min(dragging.startS, e - minWin), e });
    }
  };

  const onPointerUp = (e) => {
    if (e?.pointerId != null) pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    setDragging(null);
    // Fade the tooltip away shortly after the finger is lifted.
    if (e?.pointerType && e.pointerType !== "mouse") scheduleHide();
  };

  const last = data[i1];
  const hovered = hover != null ? data[hover] : null;
  const sameDay = data[i0]?.date?.slice(0, 10) === data[i1]?.date?.slice(0, 10);

  return (
    <div className="candle-wrap">
      <div className="overlay-toggles">
        <div className="chart-zoom">
          <button
            type="button"
            className="overlay-toggle"
            aria-label="Zoom out"
            onClick={() => zoomAt(0.5, 1.3)}
          >
            −
          </button>
          <button
            type="button"
            className="overlay-toggle"
            aria-label="Zoom in"
            onClick={() => zoomAt(0.5, 1 / 1.3)}
          >
            +
          </button>
        </div>
        {Object.keys(OVERLAY_LABELS).map((key) => (
          <button
            key={key}
            type="button"
            className={`overlay-toggle ${overlays[key] ? "on" : ""}`}
            style={overlays[key] ? { color: OVERLAY_COLORS[key], borderColor: OVERLAY_COLORS[key] } : {}}
            onClick={() => toggle(key)}
          >
            {OVERLAY_LABELS[key]}
          </button>
        ))}
        {view && (
          <button type="button" className="overlay-toggle" onClick={() => setView(null)}>
            Reset
          </button>
        )}
      </div>

      <div ref={containerRef} style={{ height: chartHeight, cursor: dragging ? "grabbing" : "crosshair" }}>
        <svg
          width={geo.width}
          height={geo.height}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          onPointerDown={onPointerDown}
          onPointerMove={onChartPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={() => setView(null)}
        >
          {/* horizontal gridlines + price labels */}
          {gridLevels.map((g, i) => (
            <g key={i}>
              <line
                x1={geo.padLeft}
                x2={geo.width - geo.padRight}
                y1={g.y}
                y2={g.y}
                style={{ stroke: "var(--chart-grid)" }}
                strokeDasharray="3 3"
              />
              <text
                x={geo.padLeft - 8}
                y={g.y + 4}
                textAnchor="end"
                fontSize="11"
                style={{ fill: "var(--chart-axis)" }}
              >
                {formatPrice(g.p)}
              </text>
            </g>
          ))}

          {/* volume bars */}
          {volumeLayer}

          {/* candlesticks */}
          {candleLayer}

          {/* Bollinger bands */}
          {overlays.bollinger && bollUpper && (
            <g>
              <polyline
                points={bollUpper}
                fill="none"
                style={{ stroke: OVERLAY_COLORS.bollinger }}
                strokeWidth="1"
                opacity="0.7"
              />
              <polyline
                points={bollLower}
                fill="none"
                style={{ stroke: OVERLAY_COLORS.bollinger }}
                strokeWidth="1"
                opacity="0.7"
              />
            </g>
          )}

          {/* moving averages */}
          {overlays.sma50 && sma50Path && (
            <polyline
              points={sma50Path}
              fill="none"
              style={{ stroke: OVERLAY_COLORS.sma50 }}
              strokeWidth="1.6"
            />
          )}
          {overlays.sma20 && sma20Path && (
            <polyline
              points={sma20Path}
              fill="none"
              style={{ stroke: OVERLAY_COLORS.sma20 }}
              strokeWidth="1.6"
            />
          )}

          {/* last-price dashed line */}
          <line
            x1={geo.padLeft}
            x2={geo.width - geo.padRight}
            y1={geo.y(last.close)}
            y2={geo.y(last.close)}
            style={{ stroke: "var(--chart-axis)" }}
            strokeDasharray="4 4"
            opacity={0.6}
          />

          {/* date ticks */}
          {dateTicks.map((t) => (
            <text
              key={t.i}
              x={t.x}
              y={geo.height - 6}
              textAnchor="middle"
              fontSize="11"
              style={{ fill: "var(--chart-axis)" }}
            >
              {sameDay ? timeLabel(data[t.i].date) : formatShortDate(data[t.i].date)}
            </text>
          ))}

          {/* hover crosshair */}
          {hover != null && !dragging && !pinch.current && (
            <line
              x1={geo.x(hover)}
              x2={geo.x(hover)}
              y1={geo.priceTop}
              y2={geo.volBottom}
              style={{ stroke: "var(--chart-crosshair)" }}
              strokeWidth="1"
              opacity={0.6}
            />
          )}

          {/* ---------- range navigator ---------- */}
          <line
            x1={geo.padLeft}
            x2={geo.width - geo.padRight}
            y1={geo.navTop - 3}
            y2={geo.navTop - 3}
            style={{ stroke: "var(--chart-grid)" }}
          />
          <polyline
            points={navPath}
            fill="none"
            style={{ stroke: "var(--chart-axis)" }}
            strokeWidth="1.2"
            opacity={0.8}
          />
          <rect
            x={navWindow.xs}
            y={geo.navTop}
            width={Math.max(2, navWindow.xe - navWindow.xs)}
            height={geo.navBottom - geo.navTop}
            fill="var(--accent)"
            opacity={0.12}
            style={{ stroke: "var(--accent)" }}
            strokeWidth="1"
          />
          <rect
            x={navWindow.xs - handleW / 2}
            y={geo.navTop}
            width={handleW}
            height={geo.navBottom - geo.navTop}
            fill="var(--accent)"
            rx={handleW / 2}
            opacity={0.9}
          />
          <rect
            x={navWindow.xe - handleW / 2}
            y={geo.navTop}
            width={handleW}
            height={geo.navBottom - geo.navTop}
            fill="var(--accent)"
            rx={handleW / 2}
            opacity={0.9}
          />
          {/* interaction surface for the navigator (topmost in this area) */}
          <rect
            x={0}
            y={geo.navTop - 6}
            width={geo.width}
            height={geo.navBottom - geo.navTop + 12}
            fill="transparent"
            style={{ cursor: dragging ? "grabbing" : "grab" }}
            onPointerDown={onNavPointerDown}
            onPointerMove={onNavPointerMove}
            onPointerUp={onPointerUp}
          />
        </svg>

        {hovered && !dragging && !pinch.current && (
          <div
            className="candle-tooltip"
            style={{
              // On touch, dock the tooltip top-left so a finger can't cover it.
              left: isNarrow ? 8 : Math.min(geo.width - 170, Math.max(4, geo.x(hover) + 14)),
              top: 8,
            }}
          >
            <div className="ct-date">{hovered.date.replace("T", " ").slice(0, 19)}</div>
            <div className="ct-row">
              <span>Open</span>
              <b>{formatPrice(hovered.open)}</b>
            </div>
            <div className="ct-row">
              <span>High</span>
              <b>{formatPrice(hovered.high)}</b>
            </div>
            <div className="ct-row">
              <span>Low</span>
              <b>{formatPrice(hovered.low)}</b>
            </div>
            <div className="ct-row">
              <span>Close</span>
              <b>{formatPrice(hovered.close)}</b>
            </div>
            <div className="ct-row">
              <span>Vol</span>
              <b>{formatLarge(hovered.volume)}</b>
            </div>
            <div className="ct-row">
              <span>Δ</span>
              <b style={{ color: hovered.close >= hovered.open ? "var(--up)" : "var(--down)" }}>
                {(((hovered.close - hovered.open) / hovered.open) * 100).toFixed(2)}%
              </b>
            </div>
          </div>
        )}
      </div>

      <p className="chart-hint muted">
        {isNarrow
          ? "Pinch or +/− to zoom · drag to pan · double-tap to reset"
          : "Scroll to zoom · drag to pan · double-click to reset"}
      </p>
    </div>
  );
}
