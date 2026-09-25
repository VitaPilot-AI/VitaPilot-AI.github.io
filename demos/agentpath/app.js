"use strict";

const SAMPLE = {
  title: "Publish an approved document",
  expected: [
    {
      tool: "documents.lookup",
      effect: "read",
      arguments: { reference: "POST-42" },
      capture: { document_id: "result.document_id", version: "result.version" }
    },
    {
      tool: "approvals.check",
      effect: "read",
      arguments: { document_id: "$document_id", version: "$version" },
      capture: { approved: "result.approved", approval_id: "result.approval_id" }
    },
    {
      tool: "documents.publish",
      effect: "write",
      requires: [{ var: "approved", equals: true }],
      arguments: {
        document_id: "$document_id",
        version: "$version",
        approval_id: "$approval_id"
      },
      expectResult: { status: "published", document_id: "$document_id" }
    }
  ],
  events: [
    {
      tool: "documents.lookup",
      effect: "read",
      arguments: { reference: "POST-42" },
      result: { document_id: "DOC-42", version: 7, status: "draft" }
    },
    {
      tool: "approvals.check",
      effect: "read",
      arguments: { document_id: "DOC-42", version: 6 },
      result: { approved: true, approval_id: "APR-22" }
    },
    {
      tool: "documents.publish",
      effect: "write",
      arguments: { document_id: "DOC-99", version: 7, approval_id: "APR-22" },
      result: { status: "published", document_id: "DOC-99" }
    },
    {
      tool: "documents.publish",
      effect: "write",
      arguments: { document_id: "DOC-99", version: 7, approval_id: "APR-22" },
      result: { status: "published", document_id: "DOC-99" }
    }
  ]
};

const ui = {
  input: document.getElementById("file-input"),
  text: document.getElementById("trace-input"),
  sample: document.getElementById("load-sample"),
  check: document.getElementById("check-button"),
  download: document.getElementById("download-report"),
  clear: document.getElementById("clear-button"),
  status: document.getElementById("status"),
  results: document.getElementById("results"),
  score: document.getElementById("score"),
  metrics: document.getElementById("metrics"),
  issues: document.getElementById("issue-list"),
  rows: document.getElementById("event-rows"),
  runName: document.getElementById("run-name")
};

let latestReport = null;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (isObject(value)) {
    const sorted = {};
    Object.keys(value).sort().forEach(function (key) {
      sorted[key] = stableValue(value[key]);
    });
    return sorted;
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function getPath(value, path) {
  const parts = String(path).split(".");
  let current = value;
  for (const part of parts) {
    if (current === null || current === undefined || !Object.prototype.hasOwnProperty.call(Object(current), part)) {
      return { found: false };
    }
    current = current[part];
  }
  return { found: true, value: current };
}

function addFinding(findings, code, message, eventIndex, severity) {
  findings.push({
    code: code,
    message: message,
    eventIndex: eventIndex,
    severity: severity || "error"
  });
}

function compareValue(actual, expected, bindings, path, findings, eventIndex) {
  if (typeof expected === "string" && expected.charAt(0) === "$") {
    const bindingName = expected.slice(1);
    if (!Object.prototype.hasOwnProperty.call(bindings, bindingName)) {
      addFinding(findings, "missing_binding", path + " expects $" + bindingName + ", but no earlier result captured it.", eventIndex);
      return;
    }
    if (stableStringify(actual) !== stableStringify(bindings[bindingName])) {
      addFinding(
        findings,
        "handoff_mismatch",
        path + " should carry $" + bindingName + " (" + stableStringify(bindings[bindingName]) + "), but observed " + stableStringify(actual) + ".",
        eventIndex
      );
    }
    return;
  }

  if (isObject(expected)) {
    if (!isObject(actual)) {
      addFinding(findings, "shape_mismatch", path + " should be an object.", eventIndex);
      return;
    }
    Object.keys(expected).forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(actual, key)) {
        addFinding(findings, "missing_field", path + "." + key + " is missing.", eventIndex);
      } else {
        compareValue(actual[key], expected[key], bindings, path + "." + key, findings, eventIndex);
      }
    });
    return;
  }

  if (Array.isArray(expected)) {
    if (stableStringify(actual) !== stableStringify(expected)) {
      addFinding(findings, "value_mismatch", path + " should equal " + stableStringify(expected) + ", but observed " + stableStringify(actual) + ".", eventIndex);
    }
    return;
  }

  if (stableStringify(actual) !== stableStringify(expected)) {
    addFinding(findings, "value_mismatch", path + " should equal " + stableStringify(expected) + ", but observed " + stableStringify(actual) + ".", eventIndex);
  }
}

function validateInput(data) {
  if (!isObject(data)) throw new Error("The JSON root must be an object.");
  if (!Array.isArray(data.expected)) throw new Error("Add an expected array of workflow steps.");
  if (!Array.isArray(data.events)) throw new Error("Add an events array of observed calls and results.");
  if (data.expected.some(function (step) { return !isObject(step) || typeof step.tool !== "string"; })) {
    throw new Error("Every expected step needs a tool name.");
  }
  if (data.events.some(function (event) { return !isObject(event) || typeof event.tool !== "string"; })) {
    throw new Error("Every observed event needs a tool name.");
  }
}

function analyze(data) {
  validateInput(data);
  const findings = [];
  const bindings = {};
  const stepErrors = new Set();
  const stepWarnings = new Set();
  const events = data.events;

  data.expected.forEach(function (step, index) {
    const event = events[index];
    if (!event) {
      addFinding(findings, "missing_step", "Expected step " + (index + 1) + " (" + step.tool + ") did not occur.", index);
      stepErrors.add(index);
      return;
    }

    if (event.tool !== step.tool) {
      addFinding(findings, "wrong_tool", "Step " + (index + 1) + " expected " + step.tool + " but observed " + event.tool + ".", index);
      stepErrors.add(index);
    }

    if (step.effect && event.effect !== step.effect) {
      addFinding(findings, "wrong_effect", "Step " + (index + 1) + " expected effect \"" + step.effect + "\" but observed \"" + (event.effect || "unspecified") + "\".", index);
      stepErrors.add(index);
    }

    if (event.isError === true || event.error) {
      addFinding(findings, "tool_error", "Step " + (index + 1) + " returned an error" + (event.error ? ": " + String(event.error) : "."), index);
      stepErrors.add(index);
    }

    (Array.isArray(step.requires) ? step.requires : []).forEach(function (guard) {
      if (!isObject(guard) || typeof guard.var !== "string") {
        addFinding(findings, "invalid_guard", "Step " + (index + 1) + " contains a malformed guard.", index);
        stepErrors.add(index);
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(bindings, guard.var)) {
        addFinding(findings, "missing_guard_value", "Step " + (index + 1) + " requires captured value $" + guard.var + ".", index);
        stepErrors.add(index);
      } else if (stableStringify(bindings[guard.var]) !== stableStringify(guard.equals)) {
        addFinding(findings, "guard_failed", "Step " + (index + 1) + " requires $" + guard.var + " to equal " + stableStringify(guard.equals) + ".", index);
        stepErrors.add(index);
      }
    });

    if (step.arguments) {
      if (!isObject(event.arguments)) {
        addFinding(findings, "missing_arguments", "Step " + (index + 1) + " has no observed arguments object.", index);
        stepErrors.add(index);
      } else {
        Object.keys(step.arguments).forEach(function (key) {
          if (!Object.prototype.hasOwnProperty.call(event.arguments, key)) {
            addFinding(findings, "missing_argument", "Step " + (index + 1) + " is missing argument " + key + ".", index);
            stepErrors.add(index);
          } else {
            const before = findings.length;
            compareValue(event.arguments[key], step.arguments[key], bindings, "step " + (index + 1) + " argument " + key, findings, index);
            if (findings.length > before) stepErrors.add(index);
          }
        });
      }
    }

    if (step.expectResult) {
      if (!isObject(event.result)) {
        addFinding(findings, "missing_result", "Step " + (index + 1) + " has no result object to check.", index);
        stepErrors.add(index);
      } else {
        const before = findings.length;
        Object.keys(step.expectResult).forEach(function (key) {
          if (!Object.prototype.hasOwnProperty.call(event.result, key)) {
            addFinding(findings, "missing_result_field", "Step " + (index + 1) + " result is missing " + key + ".", index);
          } else {
            compareValue(event.result[key], step.expectResult[key], bindings, "step " + (index + 1) + " result " + key, findings, index);
          }
        });
        if (findings.length > before) stepErrors.add(index);
      }
    }

    if (step.capture) {
      if (!isObject(event.result)) {
        addFinding(findings, "capture_without_result", "Step " + (index + 1) + " cannot capture values without a result object.", index);
        stepErrors.add(index);
      } else {
        Object.keys(step.capture).forEach(function (bindingName) {
          const captured = getPath(event, step.capture[bindingName]);
          if (!captured.found) {
            addFinding(findings, "capture_missing", "Step " + (index + 1) + " could not capture $" + bindingName + " from " + step.capture[bindingName] + ".", index);
            stepErrors.add(index);
          } else {
            bindings[bindingName] = captured.value;
          }
        });
      }
    }
  });

  for (let index = data.expected.length; index < events.length; index += 1) {
    addFinding(findings, "unexpected_event", "Unplanned tool event " + (index + 1) + " (" + events[index].tool + ") occurred.", index);
    stepErrors.add(index);
  }

  const writes = new Map();
  events.forEach(function (event, index) {
    const expectedStep = data.expected[index];
    const effect = event.effect || (expectedStep && expectedStep.effect);
    if (effect !== "write") return;
    const signature = event.tool + "|" + stableStringify(event.arguments || {});
    if (writes.has(signature)) {
      addFinding(findings, "duplicate_write", "Write step " + (index + 1) + " repeats the same tool and arguments as step " + (writes.get(signature) + 1) + ". Review whether the repeat is intended or safely idempotent.", index, "warning");
      stepWarnings.add(index);
      stepWarnings.add(writes.get(signature));
    } else {
      writes.set(signature, index);
    }
  });

  return {
    title: typeof data.title === "string" && data.title.trim() ? data.title.trim() : "Agent workflow",
    findings: findings,
    bindings: bindings,
    expectedCount: data.expected.length,
    eventCount: events.length,
    failedSteps: stepErrors.size,
    passed: findings.every(function (finding) { return finding.severity === "warning"; }),
    errorCount: findings.filter(function (finding) { return finding.severity !== "warning"; }).length,
    warningCount: findings.filter(function (finding) { return finding.severity === "warning"; }).length,
    rows: data.expected.map(function (step, index) {
      return {
        index: index,
        expected: step.tool,
        observed: events[index] ? events[index].tool : "missing",
        effect: events[index] ? (events[index].effect || step.effect || "unspecified") : (step.effect || "unspecified"),
        outcome: events[index] ? (events[index].isError || events[index].error ? "tool error" : (stepErrors.has(index) ? "review" : (stepWarnings.has(index) ? "warning" : "matched"))) : "missing",
        failed: stepErrors.has(index),
        warning: stepWarnings.has(index)
      };
    }).concat(events.slice(data.expected.length).map(function (event, offset) {
      const index = data.expected.length + offset;
      return {
        index: index,
        expected: "no step expected",
        observed: event.tool,
        effect: event.effect || "unspecified",
        outcome: "unplanned event",
        failed: true,
        warning: false
      };
    }))
  };
}

function makeMetric(value, label) {
  const box = document.createElement("div");
  box.className = "metric";
  const strong = document.createElement("strong");
  strong.textContent = String(value);
  const span = document.createElement("span");
  span.textContent = label;
  box.append(strong, span);
  return box;
}

function render(report) {
  ui.results.classList.remove("hidden");
  ui.runName.textContent = report.title;
  const scoreLabel = report.errorCount ? "REVIEW" : (report.warningCount ? "PASS*" : "PASS");
  ui.score.querySelector("strong").textContent = scoreLabel;
  ui.score.querySelector("strong").style.fontSize = scoreLabel.length > 4 ? "1rem" : "1.3rem";
  ui.score.querySelector("span").textContent = report.errorCount ? "findings need review" : (report.warningCount ? "warnings to review" : "checks matched");

  ui.metrics.replaceChildren(
    makeMetric(report.expectedCount, "expected steps"),
    makeMetric(report.eventCount, "observed events"),
    makeMetric(report.failedSteps, "steps with errors"),
    makeMetric(report.warningCount, "warnings to review")
  );

  ui.issues.replaceChildren();
  if (report.findings.length === 0) {
    const li = document.createElement("li");
    li.className = "ok";
    const dot = document.createElement("span");
    dot.className = "issue-dot";
    const text = document.createElement("span");
      text.textContent = report.warningCount ? "No blocking mismatch was found; review the warning before accepting this workflow." : "The observed sequence matched every supplied check.";
    li.append(dot, text);
    ui.issues.append(li);
  } else {
    report.findings.forEach(function (finding) {
      const li = document.createElement("li");
      li.className = finding.severity;
      const dot = document.createElement("span");
      dot.className = "issue-dot";
      const text = document.createElement("span");
      text.textContent = finding.code + " — " + finding.message;
      li.append(dot, text);
      ui.issues.append(li);
    });
  }

  ui.rows.replaceChildren();
  report.rows.forEach(function (row) {
    const tr = document.createElement("tr");
    tr.className = row.failed ? "row-error" : (row.warning ? "row-warning" : "row-ok");
    [String(row.index + 1), row.expected + " → " + row.observed, row.effect, row.outcome].forEach(function (value) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.append(td);
    });
    ui.rows.append(tr);
  });

  ui.status.className = "tool-status " + (report.errorCount ? "error" : "success");
  ui.status.textContent = report.errorCount
    ? "Review complete: " + report.errorCount + " blocking finding(s) and " + report.warningCount + " warning(s) need review."
    : (report.warningCount
      ? "Review complete: no blocking mismatches; " + report.warningCount + " warning(s) need human review."
      : "Review complete: all supplied checks matched. This validates the trace against your contract only.");
  ui.download.disabled = false;
}

function runCheck() {
  try {
    const data = JSON.parse(ui.text.value);
    const analysis = analyze(data);
    latestReport = {
      product: "AgentPath",
      title: analysis.title,
      checkedAt: new Date().toISOString(),
      passed: analysis.passed,
      status: analysis.errorCount ? "review-required" : (analysis.warningCount ? "pass-with-warnings" : "pass"),
      expectedStepCount: analysis.expectedCount,
      observedEventCount: analysis.eventCount,
      stepsWithFindings: analysis.failedSteps,
      errorCount: analysis.errorCount,
      warningCount: analysis.warningCount,
      capturedValues: analysis.bindings,
      findings: analysis.findings,
      sequence: analysis.rows
    };
    render(analysis);
  } catch (error) {
    latestReport = null;
    ui.results.classList.add("hidden");
    ui.download.disabled = true;
    ui.status.className = "tool-status error";
    ui.status.textContent = "Cannot check this trace: " + error.message;
  }
}

function loadText(text, label) {
  ui.text.value = text;
  ui.status.className = "tool-status";
  ui.status.textContent = label;
  latestReport = null;
  ui.results.classList.add("hidden");
  ui.download.disabled = true;
}

ui.text.value = JSON.stringify(SAMPLE, null, 2);
ui.sample.addEventListener("click", function () {
  loadText(JSON.stringify(SAMPLE, null, 2), "Example loaded. Select Check workflow to see the findings.");
});
ui.check.addEventListener("click", runCheck);
ui.clear.addEventListener("click", function () {
  ui.input.value = "";
  loadText("", "Paste a trace, open a JSON file, or load the example.");
});
ui.input.addEventListener("change", async function () {
  const file = ui.input.files && ui.input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    ui.status.className = "tool-status error";
    ui.status.textContent = "Choose a JSON file smaller than 5 MB.";
    ui.input.value = "";
    return;
  }
  try {
    loadText(await file.text(), "Loaded " + file.name + " locally. Select Check workflow to review it.");
  } catch (error) {
    ui.status.className = "tool-status error";
    ui.status.textContent = "Could not read this file: " + error.message;
  }
});
ui.download.addEventListener("click", function () {
  if (!latestReport) return;
  const blob = new Blob([JSON.stringify(latestReport, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "agentpath-review-report.json";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
});
