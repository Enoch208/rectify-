import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/landing/site-logo";
import { SignInForm } from "@/components/workspace/sign-in-form";

export const metadata: Metadata = { title: "Operator sign-in · Rectify" };

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020202] px-6">
      <div className="flex w-full max-w-sm flex-col gap-8 rounded-3xl border border-white/5 bg-[#070707] p-8">
        <Link href="/" aria-label="Rectify home" className="w-fit">
          <Wordmark />
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-medium tracking-tight text-white">Operator sign-in</h1>
          <p className="text-sm text-neutral-500">
            Cases, approvals and runs are only available to authenticated operators.
          </p>
        </div>
        <SignInForm />
      </div>
    </div>
  );
}
