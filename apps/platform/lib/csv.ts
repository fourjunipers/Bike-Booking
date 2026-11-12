/**
 * A small CSV reader (RFC 4180): quoted fields, doubled quotes, commas and
 * line breaks inside quotes, CRLF or LF, and a UTF-8 byte-order mark from
 * spreadsheet exports. Semicolon-separated files (the default export in many
 * locales) are detected from the header line.
 */

export type CsvTable = {
  /** Header names, trimmed and lower-cased, spaces as underscores. */
  headers: string[];
  /** One record per data line, keyed by header. `line` is the 1-based line in the file. */
  rows: { line: number; values: Record<string, string> }[];
};

export class CsvError extends Error {
  readonly code: "empty" | "unclosedQuote" | "duplicateHeader";
  readonly line: number;
  readonly detail?: string;

  // Plain fields, not constructor shorthand: the seed script loads this file
  // with Node's type stripping, which doesn't support the shorthand.
  constructor(
    code: "empty" | "unclosedQuote" | "duplicateHeader",
    line: number,
    detail?: string,
  ) {
    super(code);
    this.code = code;
    this.line = line;
    this.detail = detail;
  }
}

function detectDelimiter(firstLine: string): "," | ";" | "\t" {
  const count = (char: string) => firstLine.split(char).length - 1;
  const commas = count(",");
  if (count("\t") > commas && count("\t") >= count(";")) return "\t";
  return count(";") > commas ? ";" : ",";
}

/** Splits text into records of fields, with the line each record starts on. */
export function parseCsvRecords(
  text: string,
): { line: number; fields: string[] }[] {
  const input = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(input.split(/\r?\n/, 1)[0] ?? "");
  const records: { line: number; fields: string[] }[] = [];
  let fields: string[] = [];
  let field = "";
  let quoted = false;
  let line = 1;
  let recordLine = 1;
  let quoteLine = 1;

  const endRecord = () => {
    fields.push(field);
    field = "";
    // Skip lines that are entirely blank.
    if (fields.some((f) => f.trim() !== ""))
      records.push({ line: recordLine, fields });
    fields = [];
  };

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else {
        if (char === "\n") line++;
        field += char;
      }
    } else if (char === '"' && field.trim() === "") {
      quoted = true;
      quoteLine = line;
      field = "";
    } else if (char === delimiter) {
      fields.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      endRecord();
      line++;
      recordLine = line;
    } else field += char;
  }
  if (quoted) throw new CsvError("unclosedQuote", quoteLine);
  if (field !== "" || fields.length > 0) endRecord();
  return records;
}

/** Parses a CSV file with a header line. */
export function parseCsv(text: string): CsvTable {
  const records = parseCsvRecords(text);
  const header = records[0];
  if (!header) throw new CsvError("empty", 1);
  const headers = header.fields.map((h) =>
    h.trim().toLowerCase().replace(/\s+/g, "_"),
  );
  const seen = new Set<string>();
  for (const name of headers) {
    if (name && seen.has(name))
      throw new CsvError("duplicateHeader", header.line, name);
    seen.add(name);
  }
  return {
    headers,
    rows: records.slice(1).map(({ line, fields }) => ({
      line,
      values: Object.fromEntries(
        headers.map((name, i) => [name, (fields[i] ?? "").trim()]),
      ),
    })),
  };
}
