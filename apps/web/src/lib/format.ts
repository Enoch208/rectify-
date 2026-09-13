const timeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "UTC",
});

export function formatTime(iso: string): string {
  return `${timeFormat.format(new Date(iso))} UTC`;
}

export function shortHash(hash: string | null): string {
  return hash === null ? "none" : `${hash.slice(0, 10)}…`;
}

export function formatDuration(ms: number | null): string {
  if (ms === null) {
    return "unavailable";
  }
  return ms < 1000 ? `${String(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function formatCount(value: number | null): string {
  return value === null ? "unavailable" : value.toLocaleString("en-GB");
}
