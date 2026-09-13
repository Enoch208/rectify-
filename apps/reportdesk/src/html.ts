const htmlEscapes: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/gu, (character) => htmlEscapes[character] ?? character);

const pageStyles = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { margin: 0; background: #020202; color: #ededed; font: 14px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
main { max-width: 760px; margin: 0 auto; padding: 48px 20px; }
.brand { color: #a3a3a3; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 8px; }
h1 { font-size: 24px; margin: 0 0 8px; font-weight: 600; }
p { color: #a3a3a3; margin: 0 0 16px; }
.panel { background: #0a0a0a; border: 1px solid #1f1f1f; border-radius: 12px; padding: 20px; margin-top: 20px; }
label { display: block; color: #a3a3a3; font-size: 12px; margin: 0 0 6px; }
input, select { width: 100%; background: #020202; color: #ededed; border: 1px solid #262626; border-radius: 8px; padding: 9px 11px; font: inherit; margin-bottom: 14px; }
input:focus, select:focus, button:focus { outline: 2px solid #4275fe; outline-offset: 1px; }
button { background: #4275fe; color: #ffffff; border: 0; border-radius: 8px; padding: 9px 16px; font: inherit; font-weight: 600; cursor: pointer; }
button:disabled { opacity: 0.45; cursor: not-allowed; }
.status { color: #ededed; margin: 16px 0 0; min-height: 21px; }
.error { color: #f87171; }
.table-wrap { overflow-x: auto; margin-top: 16px; }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #1f1f1f; white-space: nowrap; }
th { color: #a3a3a3; font-weight: 500; font-size: 12px; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 16px 0 0; }
dt { color: #a3a3a3; }
dd { margin: 0; overflow-wrap: anywhere; }
`;

export const renderDocument = (title: string, body: string, script: string): string =>
  [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${pageStyles}</style>`,
    "</head>",
    "<body>",
    `<main>${body}</main>`,
    script.length > 0 ? `<script>${script}</script>` : "",
    "</body>",
    "</html>",
  ].join("\n");
