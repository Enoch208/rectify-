import type { ReactNode } from "react";
import { Alert02Icon, Loading03Icon, LockIcon, PlugSocketIcon } from "@hugeicons/core-free-icons";
import type { ContractResult } from "@/lib/api/contract";
import { EmptyState } from "./empty-state";
import { SignInLink } from "./sign-in-link";

export function ContractView<T>({
  result,
  label,
  children,
}: {
  result: ContractResult<T>;
  label: string;
  children: (data: T) => ReactNode;
}) {
  switch (result.kind) {
    case "loading":
      return (
        <EmptyState
          icon={Loading03Icon}
          title={`Loading ${label}`}
          description="Reading the API."
        />
      );
    case "not-connected":
      return (
        <EmptyState
          icon={PlugSocketIcon}
          title={`${label} not connected`}
          description={`${result.path} is not available yet. Nothing is shown until it returns real records.`}
        />
      );
    case "unauthorized":
      return (
        <EmptyState icon={LockIcon} title="Operator sign-in required" description={result.message}>
          <SignInLink />
        </EmptyState>
      );
    case "error":
      return (
        <EmptyState
          icon={Alert02Icon}
          title={`Could not load ${label}`}
          description={result.message}
        />
      );
    case "ok":
      return children(result.data);
  }
}
