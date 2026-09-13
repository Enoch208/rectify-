export const workspaceRoutes = {
  cases: "/cases",
  runs: "/runs",
} as const;

export type WorkspaceHref = (typeof workspaceRoutes)[keyof typeof workspaceRoutes];

export const workspaceNav: readonly { label: string; href: WorkspaceHref }[] = [
  { label: "Cases", href: workspaceRoutes.cases },
  { label: "Evaluation runs", href: workspaceRoutes.runs },
];

export function isActiveRoute(pathname: string, route: WorkspaceHref): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}
