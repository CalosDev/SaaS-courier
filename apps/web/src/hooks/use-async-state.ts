"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AsyncState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "error"; data: null; error: Error };

type AsyncResource<T> =
  | { status: "loading"; data: null; error: null; refresh: () => Promise<void> }
  | { status: "success"; data: T; error: null; refresh: () => Promise<void> }
  | { status: "error"; data: null; error: Error; refresh: () => Promise<void> };

export function useAsyncState<T>(loader: () => Promise<T>): AsyncResource<T> {
  const [state, setState] = useState<AsyncState<T>>({
    status: "loading",
    data: null,
    error: null,
  });

  const refresh = useCallback(async () => {
    setState({ status: "loading", data: null, error: null });

    try {
      const data = await loader();
      setState({ status: "success", data, error: null });
    } catch (error) {
      setState({
        status: "error",
        data: null,
        error: error instanceof Error ? error : new Error("Unexpected error"),
      });
    }
  }, [loader]);

  useEffect(() => {
    queueMicrotask(() => {
      void refresh();
    });
  }, [refresh]);

  return useMemo(
    () =>
      ({
        ...state,
        refresh,
      }) as AsyncResource<T>,
    [refresh, state],
  );
}
