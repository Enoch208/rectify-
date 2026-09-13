"use client";

import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";
import { z } from "zod";
import { describeFailure, postContract } from "@/lib/api/contract";

const sessionResponseSchema = z.object({});

export function SignInForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    postContract("/api/operator-session", { token }, sessionResponseSchema)
      .then(
        (result) => {
          switch (result.kind) {
            case "accepted":
              router.push("/cases");
              return;
            case "not-connected":
              setMessage(`${result.path} is not available yet.`);
              return;
            case "unauthorized":
            case "rejected":
              setMessage(result.message);
              return;
          }
        },
        (error: unknown) => {
          setMessage(describeFailure(error));
        },
      )
      .finally(() => {
        setPending(false);
      });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor="operator-token" className="text-xs font-medium text-neutral-400">
        Operator token
      </label>
      <input
        id="operator-token"
        type="password"
        value={token}
        onChange={(event) => {
          setToken(event.target.value);
        }}
        autoComplete="current-password"
        className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-white focus:border-accent-500/50 focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending || token.length === 0}
        className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-neutral-500"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {message && <p className="text-xs text-rose-200">{message}</p>}
    </form>
  );
}
