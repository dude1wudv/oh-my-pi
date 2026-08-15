<system-notice>
{{#each wakes}}Async task batch {{this.gateId}} generation {{this.generation}} woke on {{this.reason}}.
{{#if this.timer}}This is a periodic status wake, not a completion or a signal to chase pending agents. The runtime has re-armed the batch timer from this delivery. If there is no real failure or explicit blocker, end the current turn and return to passive waiting; elapsed time alone must not trigger `hub send`.

Current jobs:
{{this.jobs}}{{/if}}{{#if this.firstError}}The first child failure arrived while other jobs remain pending. Do not cancel or synthesize the batch early; retain the failure and return to passive WAIT_ALL after any necessary failure handling.

Failed:
{{this.failed}}

Pending:
{{this.pending}}{{/if}}{{#if this.allSettled}}Every child is terminal. Inspect all outcomes, verify successful artifacts, then perform one unified acceptance and synthesis pass.

Final jobs:
{{this.jobs}}{{/if}}{{#unless @last}}

{{/unless}}{{/each}}
</system-notice>
