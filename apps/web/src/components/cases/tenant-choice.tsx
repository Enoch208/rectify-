export function TenantChoice({
  tenantIds,
  disabled,
  onChoose,
}: {
  tenantIds: readonly string[];
  disabled: boolean;
  onChoose: (tenantId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
      <span className="text-xs text-amber-200">
        Choose the authoritative tenant for this thread. The choice is recorded as an operator
        clarification.
      </span>
      <div className="flex flex-wrap gap-2">
        {tenantIds.map((tenantId) => (
          <button
            key={tenantId}
            type="button"
            disabled={disabled}
            onClick={() => {
              onChoose(tenantId);
            }}
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 font-mono text-xs text-white transition-colors hover:border-accent-500/40 disabled:cursor-wait"
          >
            {tenantId}
          </button>
        ))}
      </div>
    </div>
  );
}
