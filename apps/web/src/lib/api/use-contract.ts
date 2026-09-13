"use client";

import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import { describeFailure, fetchContract, type ContractResult } from "./contract";

export function useContract<T>(path: string, schema: z.ZodType<T>) {
  const [result, setResult] = useState<ContractResult<T>>({ kind: "loading" });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchContract(path, schema, controller.signal).then(
      (next) => {
        if (!controller.signal.aborted) {
          setResult(next);
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setResult({ kind: "error", message: describeFailure(error) });
        }
      },
    );
    return () => {
      controller.abort();
    };
  }, [path, schema, revision]);

  const refresh = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  return { result, refresh };
}

export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => {
      clearInterval(timer);
    };
  }, [intervalMs]);

  return now;
}
