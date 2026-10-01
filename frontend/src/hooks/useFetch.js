import { useEffect, useState } from "react";

/**
 * Minimal data-fetching hook with loading / error state and a manual reload.
 * `fetcher` is a function returning a Promise; `deps` controls when the
 * request re-runs (mirrors useEffect dependency semantics).
 */
export default function useFetch(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetcher()
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) setError(err?.message || "Request failed");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = () => setTick((t) => t + 1);

  return { data, loading, error, reload };
}
