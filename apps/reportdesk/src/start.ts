import { fixtureManifest } from "./fixture-manifest.ts";
import { createReportDeskServer } from "./server.ts";
import { initialTenantConfigs, ReportDeskStore } from "./store.ts";

const requiredEnvironment = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const requiredUrl = (name: string): string => {
  const value = requiredEnvironment(name);
  if (!URL.canParse(value)) {
    throw new Error(`${name} must be an absolute URL`);
  }
  return value;
};

const portValue = process.env.REPORTDESK_PORT ?? "3100";
const port = Number.parseInt(portValue, 10);
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new Error("REPORTDESK_PORT must be a valid TCP port");
}

const server = createReportDeskServer({
  store: new ReportDeskStore(initialTenantConfigs),
  manifest: fixtureManifest,
  probeToken: requiredEnvironment("REPORTDESK_PROBE_TOKEN"),
  operatorToken: requiredEnvironment("REPORTDESK_OPERATOR_TOKEN"),
  operatorId: requiredEnvironment("REPORTDESK_OPERATOR_ID"),
  customerSessions: [
    {
      token: requiredEnvironment("REPORTDESK_CUSTOMER_TOKEN"),
      tenantId: "northstar",
      actorId: "maya",
      displayName: "Northstar Research demo customer",
    },
  ],
  outcomeSecret: requiredEnvironment("REPORTDESK_OUTCOME_SECRET"),
  productEventsUrl: requiredUrl("RECTIFY_PRODUCT_EVENTS_URL"),
});

server.listen(port);
