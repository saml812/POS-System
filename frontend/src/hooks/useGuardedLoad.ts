import { useEffect, useState } from "react";

export function useGuardedLoad(
  enabled: boolean,
  load: () => Promise<void>,
) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError("");

    load()
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [enabled, load]);

  return { loading, error, setError };
}
