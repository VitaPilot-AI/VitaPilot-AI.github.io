"use strict";

const MAX_BYTES = 10 * 1024 * 1024;
const DELIMITERS = [",", "\t", ";", "|"];
const SAMPLE = `invoice_id,customer,order_date,amount,status\nA-1001," Acme Labs ",2026-09-01,125.00,paid\nA-1002,Nimbus Tools,09/02/2026,48.00,paid\nA-1002,Nimbus Tools,09/02/2026,48.00,paid\nA-1003,"Lark & Co",2026/09/03,,pending\nA-1004,"Morrow Supply ",2026-09-04,82.50,paid\nA-1005,"=HYPERLINK(""https://example.com"",""view"")",2026-09-05,-5.00,pending\n,,,,\n`;

const state = { rows: null, filename: "", delimiter: ",", report: null };
const ui = {
  input: document.getElementById("file-input"),
  drop: document.getElementById("drop-zone"),
  sample: document.getElementById("sample-button"),
  status: document.getElementById("status"),
  results: document.getElementById("results"),
  name: document.getElementById("file-name"),
  shape: document.getElementById("file-shape"),
  count: document.getElementById("issue-count"),
  metrics: document.getElementById("metrics"),
  issues: document.getElementById("issue-list"),
  preview: document.getElementById("preview-table"),
  previewCount: document.getElementById("preview-count"),
  delimiter: document.getElementById("delimiter-label"),
  trim: document.getElementById("trim-option"),
  blank: document.getElementById("blank-option"),
  duplicates: document.getElementById("duplicate-option"),
  formula: document.getElementById("formula-option"),
  optionNote: document.getElementById("option-note"),
  download: document.getElementById("download-button"),
  reportDownload: document.getElementById("report-button"),
  clear: document.getElementById("clear-button"),
};

function setStatus(message, isError = false) {
  ui.status.textContent = message;
  ui.status.classList.toggle("error", isError);
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"' && field.length === 0) {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (quoted) throw new Error("This file has an unclosed quoted field. Correct the CSV and try again.");
  if (field.length || row.length || (text.length && !/[\r\n]$/.test(text))) {
    row.push(field);
    rows.push(row);
  }
  while (rows.length && rows[rows.length - 1].every((cell) => cell.trim() === "")) rows.pop();
  return rows;
}

function detectDelimiter(text) {
  const sample = text.slice(0, 100000);
  let best = { delimiter: ",", score: -1 };
  for (const delimiter of DELIMITERS) {
    let rows;
    try { rows = parseDelimited(sample, delimiter).slice(0, 30); } catch { continue; }
    const widths = rows.filter((row) => row.some((cell) => cell.trim() !== "")).map((row) => row.length);
    if (!widths.length) continue;
    const counts = new Map();
    widths.forEach((width) => counts.set(width, (counts.get(width) || 0) + 1));
    const consistent = Math.max(...counts.values());
    const columns = Math.max(...widths);
    const score = (columns > 1 ? 100 : 0) + (consistent / widths.length) * 10 + Math.min(columns, 30) / 100;
    if (score > best.score) best = { delimiter, score };
  }
  return best.delimiter;
}

function isBlankRow(row) {
  return row.every((cell) => cell.trim() === "");
}

function dateStyle(value) {
  const v = value.trim();
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(v)) return "year-first";
  if (/^\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}$/.test(v)) return "day-or-month-first";
  return "";
}

function isFormulaLike(value) {
  const cell = value.trimStart();
  if (/^[=@]/.test(cell)) return true;
  if (/^[+-]\s*(?:[A-Za-z@({]|[-+]\s*\d)/.test(cell)) return true;
  return /^[+-]\s*\d+(?:\.\d+)?\s*[*\/^+-]\s*\d/.test(cell);
}

function audit(rows, delimiter) {
  const issues = [];
  const header = rows[0] || [];
  const data = rows.slice(1);
  const nonBlankData = data.filter((row) => !isBlankRow(row));
  const normalizedHeaders = header.map((cell) => cell.trim().toLocaleLowerCase());
  const blankHeaders = header.reduce((n, cell) => n + (cell.trim() === "" ? 1 : 0), 0);
  const headerCounts = new Map();
  normalizedHeaders.filter(Boolean).forEach((cell) => headerCounts.set(cell, (headerCounts.get(cell) || 0) + 1));
  const duplicateHeaders = [...headerCounts.values()].filter((n) => n > 1).length;
  const widthMismatches = nonBlankData.filter((row) => row.length !== header.length).length;
  const blankRows = data.length - nonBlankData.length;
  let whitespaceCells = 0;
  let emptyCells = 0;
  let formulaCells = 0;
  const duplicateRows = new Map();
  for (const row of nonBlankData) {
    row.forEach((cell) => {
      if (cell !== cell.trim()) whitespaceCells += 1;
      if (cell.trim() === "") emptyCells += 1;
      if (isFormulaLike(cell)) formulaCells += 1;
    });
    const key = JSON.stringify(row);
    duplicateRows.set(key, (duplicateRows.get(key) || 0) + 1);
  }
  const exactDuplicates = [...duplicateRows.values()].reduce((n, count) => n + Math.max(count - 1, 0), 0);
  const dateColumns = [];
  for (let col = 0; col < header.length; col += 1) {
    const styles = new Set(nonBlankData.map((row) => dateStyle(row[col] || "")).filter(Boolean));
    if (styles.size > 1) dateColumns.push(header[col].trim() || `Column ${col + 1}`);
  }

  const add = (key, label, count, detail, severity = "review") => {
    issues.push({ key, label, count, detail, severity });
  };
  if (!rows.length) add("empty_file", "No data rows", 1, "The file has no readable CSV records.", "error");
  if (blankHeaders) add("blank_headers", "Blank header cells", blankHeaders, "Give each column a clear, unique name before importing.");
  if (duplicateHeaders) add("duplicate_headers", "Repeated header names", duplicateHeaders, "Header matching is case-insensitive and ignores surrounding spaces.");
  if (widthMismatches) add("row_width", "Rows with a different column count", widthMismatches, "These rows have fewer or more fields than the header. No fields are discarded.");
  if (blankRows) add("blank_rows", "Fully blank rows", blankRows, "These rows contain no values and can be skipped if you choose.");
  if (emptyCells) add("empty_cells", "Empty cells", emptyCells, "Missing values are counted but never filled automatically.");
  if (whitespaceCells) add("whitespace", "Cells with extra spaces", whitespaceCells, "Trimming is optional and leaves the original file untouched.");
  if (exactDuplicates) add("duplicates", "Exact duplicate data rows", exactDuplicates, "Only identical rows are counted. No fuzzy matching is used.");
  if (dateColumns.length) add("mixed_dates", "Columns with mixed date styles", dateColumns.length, `Review these columns; dates are never inferred or rewritten: ${dateColumns.join(", ")}.`);
  if (formulaCells) add("formula_like", "Formula-like cell values", formulaCells, "Values beginning with =, @, or an operator expression may be interpreted as formulas. Ordinary signed numbers are left unchanged.");
  if (!issues.length) add("clean", "No obvious structural issues", 0, "The basic checks found no issues. Review your destination system's import rules too.", "ok");

  return {
    filename: state.filename,
    delimiter: delimiter === "\t" ? "tab" : delimiter,
    data_rows: nonBlankData.length,
    source_rows_including_blanks: data.length,
    columns: header.length,
    blank_headers: blankHeaders,
    repeated_headers: duplicateHeaders,
    row_width_mismatches: widthMismatches,
    blank_rows: blankRows,
    empty_cells: emptyCells,
    whitespace_cells: whitespaceCells,
    exact_duplicate_rows: exactDuplicates,
    mixed_date_columns: dateColumns,
    formula_like_cells: formulaCells,
    issues,
  };
}

function getOutputRows() {
  if (!state.rows) return [];
  let rows = state.rows.map((row) => row.slice());
  if (ui.trim.checked) rows = rows.map((row) => row.map((cell) => cell.trim()));
  if (ui.blank.checked) rows = rows.filter((row, index) => index === 0 || !isBlankRow(row));
  if (ui.duplicates.checked && rows.length > 1) {
    const head = rows[0];
    const seen = new Set();
    const body = rows.slice(1).filter((row) => {
      if (isBlankRow(row)) return true;
      const key = JSON.stringify(row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    rows = [head, ...body];
  }
  if (ui.formula.checked) {
    rows = rows.map((row) => row.map((cell) => (isFormulaLike(cell) ? `'${cell}` : cell)));
  }
  return rows;
}

function csvEscape(value, delimiter) {
  const text = String(value ?? "");
  if (text.includes('"') || text.includes("\n") || text.includes("\r") || text.includes(delimiter)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function renderTable(rows) {
  ui.preview.replaceChildren();
  const header = rows[0] || [];
  const body = rows.slice(1);
  const tableHead = document.createElement("thead");
  const headRow = document.createElement("tr");
  header.forEach((cell, index) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = cell || `Column ${index + 1}`;
    headRow.append(th);
  });
  tableHead.append(headRow);
  const tableBody = document.createElement("tbody");
  const visible = body.slice(0, 20);
  visible.forEach((row) => {
    const tr = document.createElement("tr");
    for (let col = 0; col < Math.max(header.length, row.length); col += 1) {
      const td = document.createElement("td");
      td.textContent = row[col] ?? "";
      tr.append(td);
    }
    tableBody.append(tr);
  });
  ui.preview.append(tableHead, tableBody);
  ui.previewCount.textContent = `${visible.length} of ${body.length} data rows shown`;
}

function render() {
  if (!state.rows) return;
  state.report = audit(state.rows, state.delimiter);
  const outputRows = getOutputRows();
  ui.results.classList.remove("hidden");
  ui.name.textContent = state.filename;
  ui.shape.textContent = `${state.report.data_rows} nonblank data rows · ${state.report.columns} columns · ${state.report.delimiter === "tab" ? "tab" : `“${state.report.delimiter}”`} separated`;
  const actionable = state.report.issues.filter((issue) => issue.severity !== "ok");
  ui.count.textContent = String(actionable.reduce((sum, issue) => sum + issue.count, 0));
  ui.metrics.replaceChildren();
  const metrics = [
    [state.report.data_rows, "nonblank data rows"],
    [state.report.columns, "columns detected"],
    [state.report.row_width_mismatches, "row-width mismatches"],
    [state.report.exact_duplicate_rows, "exact duplicates"],
  ];
  metrics.forEach(([value, label]) => {
    const div = document.createElement("div");
    div.className = "metric";
    const strong = document.createElement("strong");
    strong.textContent = String(value);
    const span = document.createElement("span");
    span.textContent = label;
    div.append(strong, span);
    ui.metrics.append(div);
  });
  ui.issues.replaceChildren();
  state.report.issues.forEach((issue) => {
    const li = document.createElement("li");
    if (issue.severity === "ok") li.classList.add("ok");
    const dot = document.createElement("span");
    dot.className = "issue-dot";
    dot.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = issue.count ? `${issue.label} · ${issue.count}` : issue.label;
    const detail = document.createElement("span");
    detail.textContent = ` — ${issue.detail}`;
    text.append(strong, detail);
    li.append(dot, text);
    ui.issues.append(li);
  });
  ui.delimiter.textContent = state.report.delimiter === "tab" ? "TSV" : `CSV · ${state.report.delimiter}`;
  const selected = [];
  if (ui.trim.checked) selected.push("trim spaces");
  if (ui.blank.checked) selected.push("skip blank rows");
  if (ui.duplicates.checked) selected.push("remove exact duplicates");
  if (ui.formula.checked) selected.push("protect formula-like values");
  ui.optionNote.textContent = selected.length ? `Selected for the exported copy: ${selected.join(", ")}. The source rows remain unchanged.` : "No cleanup is applied until you select a rule. Ambiguous values are never inferred.";
  renderTable(outputRows);
}

function loadText(text, filename) {
  const delimiter = detectDelimiter(text);
  const rows = parseDelimited(text.replace(/^\uFEFF/, ""), delimiter);
  if (!rows.length || rows[0].length < 1) throw new Error("No CSV rows were found in this file.");
  state.rows = rows;
  state.filename = filename;
  state.delimiter = delimiter;
  [ui.trim, ui.blank, ui.duplicates, ui.formula].forEach((option) => { option.checked = false; });
  setStatus(`Loaded ${filename}. Checks run locally in this browser.`);
  render();
}

async function loadFile(file) {
  if (!file) return;
  if (file.size > MAX_BYTES) {
    setStatus("This file is larger than 10 MB. Choose a smaller CSV or TSV.", true);
    return;
  }
  try {
    loadText(await file.text(), file.name);
  } catch (error) {
    state.rows = null;
    ui.results.classList.add("hidden");
    setStatus(error instanceof Error ? error.message : "Could not read this file.", true);
  }
}

function downloadBlob(filename, mime, content) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

ui.input.addEventListener("change", (event) => loadFile(event.target.files[0]));
ui.sample.addEventListener("click", () => {
  try { loadText(SAMPLE, "synthetic-sales-export.csv"); }
  catch (error) { setStatus(error.message, true); }
});
[ui.trim, ui.blank, ui.duplicates, ui.formula].forEach((option) => option.addEventListener("change", render));
ui.download.addEventListener("click", () => {
  if (!state.rows) return;
  const output = getOutputRows().map((row) => row.map((cell) => csvEscape(cell, state.delimiter)).join(state.delimiter)).join("\r\n");
  downloadBlob(`checked-${state.filename.replace(/\.[^.]+$/, "")}.csv`, "text/csv;charset=utf-8", `\uFEFF${output}`);
});
ui.reportDownload.addEventListener("click", () => {
  if (!state.report) return;
  const report = {
    ...state.report,
    exported_at: new Date().toISOString(),
    cleanup_options: {
      trim_whitespace: ui.trim.checked,
      skip_blank_rows: ui.blank.checked,
      remove_exact_duplicates: ui.duplicates.checked,
      protect_formula_like_values: ui.formula.checked,
    },
    note: "This report contains structural counts only. CSV content is not included.",
  };
  downloadBlob(`${state.filename.replace(/\.[^.]+$/, "")}-flight-report.json`, "application/json;charset=utf-8", `${JSON.stringify(report, null, 2)}\n`);
});
ui.clear.addEventListener("click", () => {
  state.rows = null;
  state.filename = "";
  state.report = null;
  ui.input.value = "";
  ui.results.classList.add("hidden");
  setStatus("Cleared. Your file data is no longer held by this page.");
});
ui.drop.addEventListener("dragover", (event) => { event.preventDefault(); ui.drop.classList.add("dragging"); });
ui.drop.addEventListener("dragleave", () => ui.drop.classList.remove("dragging"));
ui.drop.addEventListener("drop", (event) => {
  event.preventDefault();
  ui.drop.classList.remove("dragging");
  loadFile(event.dataTransfer.files[0]);
});

const year = document.getElementById("year");
if (year) year.textContent = String(new Date().getFullYear());
