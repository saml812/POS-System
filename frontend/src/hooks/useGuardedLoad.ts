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

    setLoading(true);
    load()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [enabled, load]);

  return { loading, error, setError };
}
