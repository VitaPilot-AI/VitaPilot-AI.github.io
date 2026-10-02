# Small Spreadsheet Cleanup

Permanent offer and request builder for the reviewed $15 service.

The page is intentionally static. It produces a local request brief with a reference and an encoded email draft. It does **not** submit an order, receive files, verify payment, or promise that an email has been sent. Only row/column counts are passed from CSV Flight Check. No cell values or filenames leave that tool.

Package: one values-only table, at most 25 data rows, 10 columns, 5 MB. Customer chooses trim, blank-row removal, exact **source** duplicate removal, or review only. Out-of-scope size or unknown file size routes to a quote with no agreed price. Form changes invalidate any generated brief.

Confirm scope and a delivery date by business email before receiving data. Payment is due after accepted delivery. Stripe is the existing custom-amount link; the buyer must enter the written USD amount, and the operator must independently reconcile the transaction.

The reusable fulfillment CLI and private operating guide are in the parent workspace, outside this public website repository. Never add customer inputs, contact details, or payment records here. The downloadable demonstration files contain only synthetic data.

Validation:

```sh
node --test tests/csv-flight-check.test.cjs
NODE_PATH=/path/to/playwright/node_modules BROWSER_PATH=/path/to/chrome node tests/service-flow.cjs http://127.0.0.1:8765
```

Run commands from the website root with a local static server. Browser tests cover scope boundaries, stale briefs, email encoding, actual downloaded contents, no uploads, responsive layout, count-only tool handoff, and internal links.
