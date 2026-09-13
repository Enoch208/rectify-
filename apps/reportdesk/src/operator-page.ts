import { escapeHtml, renderDocument } from "./html.ts";

const operatorScript = `
const tokenInput = document.getElementById("operator-token");
const tenantSelect = document.getElementById("tenant");
const applyButton = document.getElementById("apply");
const statusLine = document.getElementById("status");
const result = document.getElementById("result");
const setStatus = (text, isError) => {
  statusLine.textContent = text;
  statusLine.className = isError ? "status error" : "status";
};
const renderEntries = (entries) => {
  result.replaceChildren(
    ...entries.flatMap(([term, value]) => {
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = term;
      dd.textContent = value;
      return [dt, dd];
    }),
  );
  result.hidden = false;
};
const applyFix = async () => {
  applyButton.disabled = true;
  result.hidden = true;
  setStatus("Applying configuration change", false);
  try {
    const response = await fetch("/api/demo/fix", {
      method: "POST",
      headers: { authorization: "Bearer " + tokenInput.value.trim(), "content-type": "application/json" },
      body: JSON.stringify({ tenantId: tenantSelect.value }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus("Configuration change rejected: " + payload.error, true);
      return;
    }
    const audit = payload.auditEvent;
    setStatus("Corrected export path enabled for " + payload.config.tenantId + ".", false);
    renderEntries([
      ["Tenant", payload.config.tenantId],
      ["Config revision", String(payload.config.revision)],
      ["Audit event", audit.id],
      ["Actor", audit.actorId],
      ["Revision", audit.fromRevision + " → " + audit.toRevision],
      ["Applied at", audit.occurredAt],
    ]);
  } finally {
    applyButton.disabled = false;
  }
};
applyButton.addEventListener("click", () => {
  applyFix().catch((error) => {
    setStatus("ReportDesk could not be reached: " + error.message, true);
  });
});
`;

export const renderOperatorPage = (tenantIds: readonly string[]): string => {
  const options = tenantIds
    .map((tenantId) => `<option value="${escapeHtml(tenantId)}">${escapeHtml(tenantId)}</option>`)
    .join("");
  const body = [
    '<p class="brand">ReportDesk operator</p>',
    "<h1>Human-applied configuration fix</h1>",
    "<p>This is a human-applied demo configuration change, not an agent-authored patch or deployment.</p>",
    '<section class="panel">',
    '<label for="operator-token">Operator token</label>',
    '<input id="operator-token" type="password" autocomplete="off" spellcheck="false">',
    '<label for="tenant">Tenant</label>',
    `<select id="tenant">${options}</select>`,
    '<button id="apply" type="button">Enable corrected export path</button>',
    '<p id="status" class="status" role="status"></p>',
    '<dl id="result" hidden></dl>',
    "</section>",
  ].join("\n");
  return renderDocument("ReportDesk operator", body, operatorScript);
};
