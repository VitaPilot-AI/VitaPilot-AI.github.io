const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../demos/csv-flight-check/app.js"), "utf8");

function createApp() {
  const elements = new Map();
  const downloads = [];
  const blobs = new Map();
  class Element {
    constructor(tag = "div") {
      this.tagName = tag;
      this.children = [];
      this.listeners = {};
      this.checked = false;
      this._text = "";
      const classes = new Set();
      this.classList = {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        contains: (name) => classes.has(name),
        toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
      };
    }
    set textContent(value) { this._text = String(value); this.children = []; }
    get textContent() { return this._text + this.children.map((child) => child.textContent).join(""); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this._text = ""; this.children = children; }
    setAttribute() {}
    addEventListener(event, handler) { this.listeners[event] = handler; }
    remove() {}
    click() {
      if (this.tagName === "a") downloads.push({ filename: this.download, blob: blobs.get(this.href) });
      return this.listeners.click?.({ target: this });
    }
  }
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new Element());
      return elements.get(id);
    },
    createElement: (tag) => new Element(tag),
    body: new Element("body"),
  };
  const context = vm.createContext({
    document, Blob, TextDecoder,
    URL: {
      createObjectURL(blob) { const id = `blob:${blobs.size}`; blobs.set(id, blob); return id; },
      revokeObjectURL() {},
    },
  });
  vm.runInContext(source + "\nglobalThis.app = { state, ui, parseDelimited, detectDelimiter, isFormulaLike, audit, getOutputRows, loadText, loadFile };", context);
  return { ...context.app, downloads };
}

const plain = (value) => JSON.parse(JSON.stringify(value));
const file = (name, text) => ({ name, size: Buffer.byteLength(text), arrayBuffer: async () => Buffer.from(text) });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};

test("quoted fields, escaped quotes, and trailing blank records retain their values", () => {
  const app = createApp();
  const rows = app.parseDelimited('id,note\r\n1,"line 1\r\nline ""2"""\r\n,\r\n\r\n', ",");
  assert.deepEqual(plain(rows), [["id", "note"], ["1", 'line 1\r\nline "2"'], ["", ""], [""]]);
  assert.equal(app.audit(rows, ",").blank_rows, 2);
});

test("malformed quotes fail instead of silently changing source content", () => {
  const { parseDelimited } = createApp();
  for (const source of ['a,b\nx"y,z', 'a,b\n"x"oops,y', 'a,b\n"x', 'a,b\n"x" "y",z']) {
    assert.throws(() => parseDelimited(source, ","), /quote/i);
  }
});

test("delimiter detection reads whole records beyond the old 100 KB boundary", () => {
  const app = createApp();
  app.loadText('\uFEFF"id";note\n1;"' + "x".repeat(100050) + '"\n2;ok\n', "large-field.csv");
  assert.equal(app.state.delimiter, ";");
  assert.equal(app.state.rows[1][1].length, 100050);
  assert.equal(app.state.rows[0][0], "id");
});

test("TSV extension disambiguates comma-rich fields", () => {
  const app = createApp();
  app.loadText("id\tnote\n1\tx,y,z\n2\ta,b,c\n", "contacts.TSV");
  assert.equal(app.state.delimiter, "\t");
  assert.equal(app.state.rows[1][1], "x,y,z");
});

test("missing data fields do not erase delimiter evidence in the header", () => {
  const app = createApp();
  app.loadText("id,value\n1\n2\n3\n", "incomplete.csv");
  assert.equal(app.state.delimiter, ",");
  assert.equal(app.state.report.row_width_mismatches, 3);
  assert.equal(app.state.report.columns, 2);
});

test("exact duplicate removal uses source values before trimming", () => {
  const app = createApp();
  app.loadText("customer\n Acme \nAcme\n Acme \n\n", "customers.csv");
  const original = plain(app.state.rows);
  app.ui.trim.checked = true;
  app.ui.duplicates.checked = true;
  assert.equal(app.state.report.exact_duplicate_rows, 1);
  assert.deepEqual(plain(app.getOutputRows()), [["customer"], ["Acme"], ["Acme"], [""]]);
  assert.deepEqual(plain(app.state.rows), original);
  app.ui.trim.checked = false;
  app.ui.duplicates.checked = false;
  assert.deepEqual(plain(app.getOutputRows()), original);
});

test("formula protection handles operator expressions, leading controls, and headers", () => {
  const app = createApp();
  for (const value of ["=SUM(A1:A2)", "@SUM(A1)", "+1+SUM(A1:A2)", "-1+cmd|' /C calc'!A0", "\t=1+1", "\u0001=1+1", "+1E2+SUM(A1)"]) {
    assert.equal(app.isFormulaLike(value), true, value);
  }
  for (const value of ["-5.00", "+.5", "-1e-3", "+12", "42", "text", "'=1+1"]) {
    assert.equal(app.isFormulaLike(value), false, value);
  }
  app.loadText("=header,value\n+1+SUM(A1),-5.00\n", "formulas.csv");
  assert.equal(app.state.report.formula_like_cells, 2);
  app.ui.formula.checked = true;
  assert.deepEqual(plain(app.getOutputRows()), [["'=header", "value"], ["'+1+SUM(A1)", "-5.00"]]);
});

test("download round-trips a blank final record and uses the TSV file type", async () => {
  const app = createApp();
  app.loadText("id\tnote\n1\tx\n\n", "data.tsv");
  app.ui.download.click();
  const download = app.downloads[0];
  assert.equal(download.filename, "checked-data.tsv");
  assert.match(download.blob.type, /tab-separated-values/);
  const exported = (await download.blob.text()).replace(/^\uFEFF/, "");
  assert.deepEqual(plain(app.parseDelimited(exported, "\t")), plain(app.state.rows));
});

test("oversized and malformed uploads invalidate both previous exports", async () => {
  const app = createApp();
  app.loadText("id\nSECRET\n", "previous.csv");
  await app.loadFile({ name: "oversized.csv", size: 11 * 1024 * 1024 });
  assert.equal(app.state.rows, null);
  assert.equal(app.state.report, null);
  app.ui.download.click();
  app.ui.reportDownload.click();
  assert.equal(app.downloads.length, 0);
  app.loadText("id\nSECRET\n", "previous.csv");
  await app.loadFile(file("invalid.csv", 'id\n"broken'));
  assert.equal(app.state.rows, null);
  assert.equal(app.state.report, null);
  assert.equal(app.ui.preview.textContent, "");
  app.ui.reportDownload.click();
  assert.equal(app.downloads.length, 0);
});

test("clearing cancels pending reads and removes retained preview data", async () => {
  const app = createApp();
  app.loadText("id\nSECRET\n", "private.csv");
  app.ui.clear.click();
  assert.equal(app.ui.preview.textContent, "");
  assert.equal(app.ui.name.textContent, "");
  assert.equal(app.state.report, null);
  const pending = deferred();
  const loading = app.loadFile({ name: "late.csv", size: 10, arrayBuffer: () => pending.promise });
  app.ui.clear.click();
  pending.resolve(Buffer.from("id\nLATE\n"));
  await loading;
  assert.equal(app.state.rows, null);
  assert.equal(app.ui.status.textContent, "Cleared. Your file data is no longer held by this page.");
});

test("a newer file wins over an older pending read", async () => {
  const app = createApp();
  const pending = deferred();
  const oldLoading = app.loadFile({ name: "older.csv", size: 10, arrayBuffer: () => pending.promise });
  await app.loadFile(file("newer.csv", "id\nNEW\n"));
  pending.resolve(Buffer.from("id\nOLD\n"));
  await oldLoading;
  assert.equal(app.state.filename, "newer.csv");
  assert.equal(app.state.rows[1][0], "NEW");
});

test("a superseded read failure does not erase a freshly loaded sample", async () => {
  const app = createApp();
  const pending = deferred();
  const loading = app.loadFile({ name: "bad.csv", size: 10, arrayBuffer: () => pending.promise });
  app.ui.sample.click();
  pending.reject(new Error("stale failure"));
  await loading;
  assert.equal(app.state.filename, "synthetic-sales-export.csv");
  assert.ok(app.state.report);
  assert.doesNotMatch(app.ui.status.textContent, /stale failure/);
});

test("invalid UTF-8 and null-containing files fail without silent corruption", async () => {
  const app = createApp();
  await app.loadFile({ name: "latin1.csv", size: 4, arrayBuffer: async () => Uint8Array.from([0x69, 0x64, 0x0a, 0xff]) });
  assert.equal(app.state.rows, null);
  assert.match(app.ui.status.textContent, /not valid UTF-8/);
  await app.loadFile(file("utf16.csv", "i\u0000d\u0000"));
  assert.equal(app.state.rows, null);
  assert.match(app.ui.status.textContent, /null characters/);
});

test("reports omit CSV headers and cell values; service handoff contains counts only", async () => {
  const app = createApp();
  app.loadText("PRIVATE_HEADER,other\n2026-01-02,PRIVATE_VALUE\n01/02/2026,a,overflow\n", "report.csv");
  app.ui.reportDownload.click();
  const report = await app.downloads[0].blob.text();
  assert.doesNotMatch(report, /PRIVATE_HEADER|PRIVATE_VALUE/);
  assert.match(report, /Column 1/);
  assert.equal(app.ui.service.href, "../../services/spreadsheet-cleanup/?rows=2&columns=3");
  app.ui.clear.click();
  assert.equal(app.ui.service.href, "../../services/spreadsheet-cleanup/");
});
