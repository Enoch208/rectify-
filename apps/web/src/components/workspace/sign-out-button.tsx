"use client";

import { Logout01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { deleteContract, describeFailure } from "@/lib/api/contract";

const sessionResponseSchema = z.object({});

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const signOut = () => {
    setPending(true);
    setFailure(null);
    deleteContract("/api/operator-session", sessionResponseSchema)
      .then(
        (result) => {
          if (result.kind === "accepted") {
            router.push("/sign-in");
            return;
          }
          setFailure(
            result.kind === "not-connected" ? "Session endpoint unavailable" : result.message,
          );
        },
        (error: unknown) => {
          setFailure(describeFailure(error));
        },
      )
      .finally(() => {
        setPending(false);
      });
  };

  return (
    <div className="flex items-center gap-3">
      {failure && <span className="text-xs text-rose-200">{failure}</span>}
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:text-white disabled:cursor-wait"
      >
        <HugeiconsIcon icon={Logout01Icon} size={14} />
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
