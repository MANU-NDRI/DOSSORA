import { useCallback, useEffect, useRef, useState } from 'react';
import { reportError } from '@/lib/diagnostics';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: unknown;
}

/** Charge une donnée asynchrone avec états loading / error / reload. */
export function useAsync<T>(fn: () => Promise<T>, deps: ReadonlyArray<unknown>) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef
      .current()
      .then((data) => {
        if (alive) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        reportError('Requête échouée', error);
        if (alive) setState((current) => ({ data: current.data, loading: false, error }));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
