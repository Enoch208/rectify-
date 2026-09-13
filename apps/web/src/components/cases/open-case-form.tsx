"use client";

import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";
import {
  ambiguousIntakeResponseSchema,
  postCaseResponseSchema,
  type PostCaseRequest,
} from "@rectify/core";
import { describeFailure, postContract } from "@/lib/api/contract";
import { TenantChoice } from "./tenant-choice";

export function OpenCaseForm() {
  const router = useRouter();
  const [threadId, setThreadId] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tenantIds, setTenantIds] = useState<readonly string[]>([]);

  const open = (request: PostCaseRequest) => {
    setPending(true);
    setMessage(null);
    postContract("/api/cases", request, postCaseResponseSchema)
      .then(
        (result) => {
          switch (result.kind) {
            case "accepted":
              router.push(`/cases/${encodeURIComponent(result.data.case.id)}`);
              return;
            case "not-connected":
              setMessage(`${result.path} is not available yet.`);
              return;
            case "unauthorized":
              setMessage(`Sign in required: ${result.message}`);
              return;
            case "rejected": {
              const ambiguous = ambiguousIntakeResponseSchema.safeParse(result.body);
              setTenantIds(ambiguous.success ? ambiguous.data.tenantIds : []);
              setMessage(result.message);
              return;
            }
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

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTenantIds([]);
    open({ gmailThreadId: threadId.trim() });
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-[#0A0A0A] p-5"
    >
      <label htmlFor="gmail-thread" className="text-sm font-medium text-white">
        Open a case from a Gmail thread
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="gmail-thread"
          value={threadId}
          onChange={(event) => {
            setThreadId(event.target.value);
            setTenantIds([]);
          }}
          placeholder="Gmail thread ID"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/40 px-4 py-2 font-mono text-sm text-white placeholder:text-neutral-600 focus:border-accent-500/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || threadId.trim().length === 0}
          className="rounded-full bg-white px-5 py-2 text-xs font-medium text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-neutral-500"
        >
          {pending ? "Opening…" : "Open case"}
        </button>
      </div>
      {tenantIds.length > 0 && (
        <TenantChoice
          tenantIds={tenantIds}
          disabled={pending}
          onChoose={(tenantId) => {
            open({ gmailThreadId: threadId.trim(), tenantId });
          }}
        />
      )}
      <p className="text-xs text-neutral-500">
        {message ??
          "Only threads in the trusted intake directory open a case. Re-opening a thread resumes its case."}
      </p>
    </form>
  );
}
