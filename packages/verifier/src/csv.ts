import { csvExportRowSchema, type CsvExportExpectation } from "@rectify/core";

const parseCells = (line: string): string[] => {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line.charAt(index);
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  if (quoted) {
    throw new Error("Unterminated quoted CSV field");
  }
  cells.push(current);
  return cells;
};

const splitLines = (csv: string): string[] => {
  const lines: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv.charAt(index);
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        current += '""';
        index += 1;
      } else {
        quoted = !quoted;
        current += character;
      }
    } else if (character === "\n" && !quoted) {
      lines.push(current.endsWith("\r") ? current.slice(0, -1) : current);
      current = "";
    } else {
      current += character;
    }
  }
  if (quoted) {
    throw new Error("Unterminated quoted CSV record");
  }
  if (current.length > 0) {
    lines.push(current);
  }
  return lines;
};

export const parseExportCsv = (
  csv: string,
): { schema: string[]; rows: CsvExportExpectation["rows"] } => {
  const lines = splitLines(csv);
  const schema = parseCells(lines[0] ?? "");
  const rows = lines.slice(1).map((line) => {
    const cells = parseCells(line);
    if (cells.length !== 5) {
      throw new Error(`Expected 5 CSV columns but received ${String(cells.length)}`);
    }
    return csvExportRowSchema.parse({
      recordId: cells[0],
      tenantId: cells[1],
      period: cells[2],
      amount: cells[3],
      status: cells[4],
    });
  });
  return { schema, rows };
};
