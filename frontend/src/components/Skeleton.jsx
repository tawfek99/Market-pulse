/**
 * Shimmering placeholder block used while data loads. Renders a rounded
 * rectangle of the given size with a subtle sweep animation — much more
 * professional than a bare spinner.
 */
export default function Skeleton({ height = 200, width = "100%", radius = 10, style }) {
  return (
    <div
      className="skeleton"
      style={{ height, width, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}
