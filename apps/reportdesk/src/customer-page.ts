import { escapeHtml, renderDocument } from "./html.ts";

const customerScript = `
const root = document.getElementById("export-app");
const caseId = root.dataset.caseId;
const tokenInput = document.getElementById("token");
const periodSelect = document.getElementById("period");
const exportButton = document.getElementById("export");
const signedIn = document.getElementById("signed-in");
const statusLine = document.getElementById("status");
const result = document.getElementById("result");
let sessionToken = "";
const setStatus = (text, isError) => {
  statusLine.textContent = text;
  statusLine.className = isError ? "status error" : "status";
};
const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted && character === '"' && text[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (!quoted && character === ",") {
      row.push(field);
      field = "";
    } else if (!quoted && character === "\\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (quoted || character !== "\\r") {
      field += character;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
};
const cellRow = (values, tag) => {
  const tr = document.createElement("tr");
  for (const value of values) {
    const cell = document.createElement(tag);
    cell.textContent = value;
    tr.append(cell);
  }
  return tr;
};
const renderTable = (rows) => {
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const body = document.createElement("tbody");
  head.append(cellRow(rows[0] ?? [], "th"));
  body.append(...rows.slice(1).map((values) => cellRow(values, "td")));
  table.append(head, body);
  result.replaceChildren(table);
};
const resetSession = () => {
  sessionToken = "";
  exportButton.disabled = true;
  periodSelect.disabled = true;
  signedIn.hidden = true;
  result.replaceChildren();
};
const checkSession = async () => {
  resetSession();
  const token = tokenInput.value.trim();
  if (token.length === 0) {
    setStatus("", false);
    return;
  }
  const response = await fetch("/api/customer/session", { headers: { authorization: "Bearer " + token } });
  if (!response.ok) {
    setStatus("That session token was not recognised.", true);
    return;
  }
  const session = await response.json();
  periodSelect.replaceChildren(...session.periods.map((period) => new Option(period, period)));
  signedIn.textContent = "Signed in as the " + session.displayName;
  signedIn.hidden = false;
  sessionToken = token;
  periodSelect.disabled = false;
  exportButton.disabled = session.periods.length === 0;
  setStatus("", false);
};
const runExport = async () => {
  exportButton.disabled = true;
  result.replaceChildren();
  setStatus("Exporting", false);
  try {
    const response = await fetch("/api/customer/export", {
      method: "POST",
      headers: { authorization: "Bearer " + sessionToken, "content-type": "application/json" },
      body: JSON.stringify({ caseId, period: periodSelect.value }),
    });
    if (!response.ok) {
      const failure = await response.json();
      setStatus("Export failed: " + failure.error, true);
      return;
    }
    const rows = parseCsv(await response.text());
    renderTable(rows);
    const count = Math.max(0, rows.length - 1);
    const summary = "Export complete. " + count + (count === 1 ? " row" : " rows") + " exported.";
    setStatus(count === 0 ? summary + " The export returned no records." : summary, false);
  } finally {
    exportButton.disabled = sessionToken.length === 0;
  }
};
const reportFailure = (error) => {
  setStatus("ReportDesk could not be reached: " + error.message, true);
};
tokenInput.addEventListener("change", () => {
  checkSession().catch(reportFailure);
});
exportButton.addEventListener("click", () => {
  runExport().catch(reportFailure);
});
`;

const pageHeader = '<p class="brand">ReportDesk</p><h1>Monthly report export</h1>';

export const renderCustomerPage = (caseId: string | null, periods: readonly string[]): string => {
  if (caseId === null || caseId.length === 0) {
    const body = `${pageHeader}<section class="panel"><p class="error" role="alert">This export link is missing its case reference. Open the link from your support conversation to continue.</p></section>`;
    return renderDocument("ReportDesk", body, "");
  }
  const options = periods
    .map((period) => `<option value="${escapeHtml(period)}">${escapeHtml(period)}</option>`)
    .join("");
  const body = [
    pageHeader,
    `<section class="panel" id="export-app" data-case-id="${escapeHtml(caseId)}">`,
    '<label for="token">Customer session token</label>',
    '<input id="token" type="password" autocomplete="off" spellcheck="false">',
    '<p id="signed-in" hidden></p>',
    '<label for="period">Period</label>',
    `<select id="period" disabled>${options}</select>`,
    '<button id="export" type="button" disabled>Export CSV</button>',
    '<p id="status" class="status" role="status"></p>',
    '<div id="result" class="table-wrap"></div>',
    "</section>",
  ].join("\n");
  return renderDocument("ReportDesk", body, customerScript);
};
