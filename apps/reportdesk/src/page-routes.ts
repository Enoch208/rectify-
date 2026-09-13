import type { Route } from "./context.ts";
import { renderCustomerPage } from "./customer-page.ts";
import { sendHtml } from "./http.ts";
import { renderOperatorPage } from "./operator-page.ts";

const customerPage: Route = {
  method: "GET",
  path: "/customer",
  handle: (context) => {
    const caseId = context.url.searchParams.get("case");
    const periods = [...new Set(context.desk.manifest.tenants.map((fixture) => fixture.period))];
    const hasCase = caseId !== null && caseId.length > 0;
    sendHtml(context.response, hasCase ? 200 : 400, renderCustomerPage(caseId, periods));
  },
};

const operatorPage: Route = {
  method: "GET",
  path: "/operator",
  handle: (context) => {
    sendHtml(context.response, 200, renderOperatorPage(context.desk.store.getTenantIds()));
  },
};

export const pageRoutes: readonly Route[] = [customerPage, operatorPage];
