import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../services/api";

export function useResource<T>(path: string, interval = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const current = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++current.current;
    try {
      const result = await api<T>(path);
      if (current.current === version) {
        setData(result);
        setError("");
      }
    } catch (e) {
      if (current.current === version) setError(errorMessage(e));
    } finally {
      if (current.current === version) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    const generation = current;
    setLoading(true);
    setData(null);
    void refresh();
    const timer = interval
      ? window.setInterval(() => {
          if (!document.hidden) void refresh();
        }, interval)
      : undefined;
    return () => {
      generation.current++;
      window.clearInterval(timer);
    };
  }, [refresh, interval]);
  return { data, error, loading, refresh };
}
