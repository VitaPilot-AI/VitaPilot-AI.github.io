"use strict";
(() => {
  const form = document.getElementById("request-form");
  const rows = document.getElementById("rows");
  const columns = document.getElementById("columns");
  const size = document.getElementById("file-size");
  const fit = document.getElementById("fit-status");
  const section = document.getElementById("brief-section");
  const brief = document.getElementById("brief");
  const status = document.getElementById("brief-status");
  const email = document.getElementById("email-brief");
  let reference = "";
  let downloadUrl = "";
  const validCount = (input) => /^\d+$/.test(input.value) && input.checkValidity() && Number(input.value) > 0;
  const withinPackage = () => validCount(rows) && validCount(columns) && Number(rows.value) <= 25 && Number(columns.value) <= 10 && size.value === "within";
  function update() {
    section.hidden = true;
    brief.value = "";
    email.href = "mailto:info@vitapilotai.com";
    if (downloadUrl) { URL.revokeObjectURL(downloadUrl); downloadUrl = ""; }
    const counts = validCount(rows) && validCount(columns);
    fit.classList.toggle("quote", counts && !withinPackage());
    fit.textContent = !counts ? "Enter row and column counts to check the package size." : withinPackage() ? "Within the $15 package size. File contents and cleanup rules still need confirmation by email." : "A separate scope check is needed. Send a quote request; do not pay $15 for this file yet.";
  }
  const params = new URLSearchParams(location.search);
  for (const input of [rows, columns]) {
    const value = params.get(input.id);
    if (value && /^\d{1,7}$/.test(value) && Number(value) >= 1 && Number(value) <= Number(input.max)) input.value = value;
  }
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const rules = Array.from(form.querySelectorAll('input[name="rule"]:checked'), input => input.value);
    if (rules.length === 0) { fit.textContent = "Choose at least one cleanup rule, or select review only."; return; }
    if (rules.length > 1 && rules.some(rule => rule.startsWith("Review only"))) { fit.textContent = "Choose review only or cleanup rules; these options cannot be combined."; return; }
    if (!reference) reference = `VP-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const plan = withinPackage() ? "Small Spreadsheet Cleanup — USD $15, subject to scope confirmation" : "Quote request — no price agreed";
    brief.value = [
      "VitaPilot AI — Spreadsheet Cleanup Request", `Reference: ${reference}`, `Package: ${plan}`, "",
      `Format: ${document.getElementById("format").value}`, `Data rows (excluding header): ${rows.value}`, `Columns: ${columns.value}`, `File size: ${size.options[size.selectedIndex].text}`,
      "", "Requested rules:", ...rules.map(rule => `- ${rule}`), "",
      `Task notes: ${document.getElementById("notes").value.trim() || "None"}`, "",
      "Please confirm the scope, price, delivery date, file-sharing method, AI-use restrictions, and retention terms before work begins. I will only share non-sensitive data I am authorized to provide.",
      "", "This is an inquiry, not an accepted order or payment. Please reply to the email address I send this from."
    ].join("\n");
    email.href = `mailto:info@vitapilotai.com?subject=${encodeURIComponent(`${reference} — Spreadsheet cleanup ${withinPackage() ? "request" : "quote"}`)}&body=${encodeURIComponent(brief.value)}`;
    status.textContent = "Nothing has been sent. Open your email app, or copy the brief into an email to info@vitapilotai.com.";
    section.hidden = false;
    document.getElementById("brief-heading").focus();
  });
  document.getElementById("copy-brief").addEventListener("click", async () => {
    if (!brief.value) return;
    try { await navigator.clipboard.writeText(brief.value); status.textContent = "Brief copied. Paste it into an email to info@vitapilotai.com and send it. Nothing has been sent by this page."; }
    catch { brief.focus(); brief.select(); status.textContent = "Select and copy the brief, then email it to info@vitapilotai.com. Clipboard access was unavailable."; }
  });
  document.getElementById("download-brief").addEventListener("click", () => {
    if (!brief.value) return;
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(new Blob([brief.value], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = downloadUrl; link.download = `${reference}-request.txt`; link.click();
    status.textContent = "Brief downloaded. Email it to info@vitapilotai.com to submit your request. Nothing has been sent by this page.";
  });
  email.addEventListener("click", () => { status.textContent = "Your email app may open with a draft. Send that email to submit the request; this page cannot confirm delivery."; });
  update();
})();
