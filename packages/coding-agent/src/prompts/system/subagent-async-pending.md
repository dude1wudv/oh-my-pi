Your `yield` recorded; {{count}} background job{{#if multiple}}s{{/if}} you own {{#if multiple}}are{{else}}is{{/if}} still running: {{jobs}}.

If these jobs belong to an active async batch gate, remain passive: individual results update the gate only and do not require a fresh yield, `hub wait`, coordination message, or re-dispatch. The runtime wakes Main once at the configured timer interval with aggregate counts, or once when every item reaches success, failure, cancellation, timeout, or dispatch failure.

User messages, explicit failure/blocker, cancellation, or safety events may interrupt the gate. On an all-settled wake, Main reads all artifacts, verifies them, and synthesizes once. Do not claim completion from a partial result.
