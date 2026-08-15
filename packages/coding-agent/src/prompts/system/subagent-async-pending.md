Your `yield` recorded; {{count}} background job{{#if multiple}}s{{/if}} you own {{#if multiple}}are{{else}}is{{/if}} still running: {{jobs}}.

If these jobs belong to an active async batch gate, remain passive: individual results update the gate only and do not require a fresh yield, polling, coordination message, or re-dispatch. The runtime wakes Main on the first failure, when every item reaches success, failure, cancellation, timeout, or dispatch failure, and by default every 20m with a periodic aggregate status. It re-arms the timer from every non-terminal aggregate delivery; explicit `off` disables only periodic wakes.

User messages, cancellation, and safety events may interrupt immediately. On an all-settled wake, Main reads all artifacts, verifies them, and synthesizes once. On a periodic wake without a real failure or blocker, end the turn and resume passive waiting; elapsed time alone must never trigger a coordination nudge. Do not claim completion from a partial result.
