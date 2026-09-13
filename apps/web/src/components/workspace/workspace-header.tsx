import Link from "next/link";

export function WorkspaceHeader() {
  return (
    <header className="flex flex-col justify-between gap-4 px-5 pt-6 pb-6 md:flex-row md:items-center lg:px-8 lg:pt-8">
      <div className="flex items-center gap-4">
        <span className="text-3xl font-medium tracking-tight text-white lg:text-4xl">
          Workspace
        </span>
        <div className="mx-2 h-8 w-px bg-white/10" />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-white">Support operations</span>
          <span className="text-xs text-neutral-500">Gmail · GitHub · Slack</span>
        </div>
      </div>

      <div className="flex items-center self-start rounded-full border border-white/5 bg-white/[0.04] p-1 md:self-center">
        <span className="rounded-full bg-white/10 px-5 py-1.5 text-xs font-medium text-white">
          Workspace
        </span>
        <Link
          href="/"
          className="px-5 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:text-white"
        >
          Site
        </Link>
      </div>
    </header>
  );
}
