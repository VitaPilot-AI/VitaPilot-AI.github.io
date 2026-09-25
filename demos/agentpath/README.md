# AgentPath

AgentPath is a dependency-free, browser-local reviewer for an expected agent workflow and a captured sequence of tool-call/result events.

It checks:

- tool order, missing steps, and unplanned events
- selected argument fields, including values captured from earlier results
- selected result fields
- approval guards based on earlier captured values
- tool errors and repeated write calls

## Use

Open the local index.html in a browser or visit the VitaPilot demos page. Load the built-in example, paste a JSON document, or choose a local .json file. Select **Check workflow** to review it. A JSON report can be downloaded after analysis.

A JSON document has expected steps and observed events. The sample-trace.json file documents the supported shape. In expected step arguments, a string such as $document_id refers to a value captured earlier. A step can capture values from its result with dotted paths, for example document_id from result.document_id. A requires entry checks a previously captured value before the step is evaluated.

Observed traces must be mapped into this small AgentPath format first. AgentPath does not connect to an MCP or other agent server, parse vendor-specific trace exports, make model calls, or execute actions.

## Limits

A passing report means only that the supplied trace matched the supplied checks. It does not prove that an external side effect occurred, that a tool was safe, or that the expected contract itself is correct. Do not load secrets or unredacted sensitive data. Files are processed in the current browser tab and are not uploaded by this app.

## Workflow Check Pack

VitaPilot AI LLC offers a fixed-scope review of one workflow with up to 10 expected steps and 5 redacted traces in the documented AgentPath JSON format. The USD $25 package includes a Markdown findings report linked to observed trace events, the JSON findings export, and a deterministic acceptance-checklist draft. Turnaround is two business days after complete inputs and payment; one factual correction within scope is included. It does not include vendor-specific trace conversion, production access, or execution of tools. Confirm scope by email before paying; the hosted Stripe checkout takes a custom USD amount, so enter $25.00 rather than selecting a quantity.

The [synthetic sample review](sample-review.md) shows the report format. It is fictional demonstration data, not client work or a claim of past experience.
