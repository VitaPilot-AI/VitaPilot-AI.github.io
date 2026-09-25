# AgentPath Workflow Check Pack — Synthetic Sample

This fictional example uses the bundled `sample-trace.json`. It is not client work or evidence of prior experience.

## Scope represented

- Expected workflow: look up a document, check approval, publish the approved version.
- Expected steps: 3.
- Observed events: 4.
- Result: review required.

## Findings

1. **Approval version mismatch (step 2).** The lookup returned version `7`, but the approval check used version `6`. Approval for a different version does not satisfy the supplied workflow contract.
2. **Document handoff mismatch (step 3).** The publish call used `DOC-99`; the lookup captured `DOC-42`. The publish result also reports `DOC-99` instead of the expected captured document.
3. **Unexpected extra write (event 4).** A second `documents.publish` event appears after the three expected steps.
4. **Repeated write warning (event 4).** The extra publish has the same tool and arguments as the preceding publish. Review whether retry behavior is intentional and safely idempotent.

## Acceptance checklist draft

- The approval check uses the document ID and version returned by the lookup.
- A write is permitted only after approval for that same document version is confirmed.
- The publish call and its result refer to the approved document ID.
- A repeated write is either prevented or shown to be safe under the workflow's idempotency rules.
- Any retry is visible in the final trace and does not create an unintended second side effect.

## Limits

These findings describe only the supplied JSON trace and expected contract. They do not establish whether a real document was published, whether a side effect was authorized, or whether the workflow is safe. The trace and all values here are synthetic.
