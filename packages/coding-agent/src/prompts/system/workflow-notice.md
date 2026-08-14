<system-notice>
User message contains **workflowz** → deterministic multi-subagent workflow. Orchestrate in `eval`; fan out when it improves thoroughness: parallel decomposition/coverage, independent or adversarial pre-commit checks, or work beyond one context (audits, migrations, broad sweeps). Overrides doing work inline when fan-out is more thorough.

<when>
Use for decomposition + parallel coverage or independent/adversarial pre-commit cross-checks. Quick lookup/single edit: direct; no agents. {{#if scoutAvailable}} Scout inline FIRST{{else}} Explore inline FIRST{{/if}} — list files, scope diff, find call sites — to discover work-list; know its shape before fan-out, not task start. Chain well-scoped `eval` calls across turns:
- **Understand**: parallel subsystem readers → structured map
- **Design**: N independent approaches, judge panel → scored synthesis
- **Review**: dimensions → findings per dimension → adversarial verification
- **Research**: multi-modal sweep → deep-read hits → synthesize
- **Migrate**: discover sites → transform each → verify
</when>

<helpers>
State persists across `eval` calls;{{#if scoutAvailable}} scout one call, fan out next.{{else}} explore one call, fan out next.{{/if}} Every call provides:

 - `agent(prompt, *, agent="task", label=None, schema=None, isolated=None, apply=None, merge=None, handle=False)`: run ONE subagent; return final text, or validated object with `schema` (JSON Schema dict). `schema` MUST be a valid JSON Schema object when supplied; NEVER pass a boolean such as `false` as an output schema. If structured validation is unnecessary, omit `schema` rather than using a rejecting placeholder. `schema` forces validated structured output: branch on object, not parsed prose. `agent` selects discovered agent{{#if scoutAvailable}} (`"scout"`, `"reviewer", …`){{/if}}`; `label`: artifact name. Put shared background in `local://` file referenced by each prompt, not a parameter. Subagents' final text is return value: raw data.
 - `parallel(thunks)`: concurrently run zero-arg callables in bounded pool; preserve input order; return after all finish. Pool: session `task` concurrency — do not hand-tune; fan out as work divides. Raised thunk propagates; risky thunk: `try/except` for partial results. Loop closures: bind default arg (`lambda d=d: …`), else all capture final value.
 - `pipeline(items, *stages)`: map items through stages left→right. It creates a BARRIER between stages: ALL items must complete before the next stage. Stages: one-arg callable; stage 1 gets original item, later stages prior result. Same pool width as `parallel()`.
- `completion(prompt, *, model="default", system=None, schema=None)`: oneshot stateless model call; no tools/history. Tiers: `"smol"`, `"default"`, `"slow"`. Use for cheap fan-out classification/scoring.
- `log(message)`: progress line above status tree. `phase(title)`: phase; following status lines group under it.
- `budget`: `budget.total` output-token ceiling/`None` if unset; `budget.spent()` tokens spent this turn (main loop + eval subagents); `budget.remaining()`/`math.inf` if total `None`; `budget.hard` enforcement. User `+Nk`: advisory, self-limit via `budget.remaining()`; `+Nk!`/Goal Mode: hard, `agent()` refuses spawn at spent ceiling. Gate loops on `budget.total` first: no user budget → `None`.

All execution INLINE, synchronous within `eval`: no background mode, resume, separate progress app. One call: one well-scoped fan-out. Chain calls/turns for phases; read each result before next-phase decision.
</helpers>

<structure>
Independent per-item chains (review → verify, fetch → extract → score): wrap WHOLE chain in one function; `parallel()` functions so items proceed independently.

**Python (`eval`, Python backend):**

```python
DIMENSIONS = [{"key": "bugs", "prompt": "…"}, {"key": "perf", "prompt": "…"}]
def review_and_verify(d):
    found = agent(d["prompt"], label=f"review:{d['key']}", schema=FINDINGS_SCHEMA)
    return parallel([lambda f=f: {**f, "verdict": agent(
        f"Refute if you can (default refuted when unsure): {f['title']}",
        label=f"verify:{f['file']}", schema=VERDICT_SCHEMA)} for f in found["findings"]])
phase("Review")
results = parallel([lambda d=d: review_and_verify(d) for d in DIMENSIONS])
confirmed = [f for group in results for f in group if f["verdict"]["is_real"]]
```

**JavaScript (`eval`, JavaScript backend):**

```js
const DIMENSIONS = [{ key: "bugs", prompt: "…" }, { key: "perf", prompt: "…" }];
async function reviewAndVerify(d) {
    const found = await agent(d.prompt, {
        label: `review:${d.key}`,
        schema: FINDINGS_SCHEMA,
    });
    return await parallel(found.findings.map((f) => async () => ({
        ...f,
        verdict: await agent(
            `Refute if you can (default refuted when unsure): ${f.title}`,
            { label: `verify:${f.file}`, schema: VERDICT_SCHEMA },
        ),
    })));
}
phase("Review");
const results = await parallel(DIMENSIONS.map((d) => async () => reviewAndVerify(d)));
const confirmed = results.flat().filter((f) => f.verdict.is_real);
```

`pipeline()` only if a stage needs ALL prior-stage results: whole-set dedup/merge, zero early exit, or comparison with other findings. Its barrier waits for the slowest peer.

**Python (`eval`, Python backend):**

```python
phase("Find")
found = parallel([lambda d=d: agent(d["prompt"], schema=FINDINGS_SCHEMA) for d in DIMENSIONS])
findings = dedupe([f for r in found for f in r["findings"]])   # needs everything at once
phase("Verify")
verdicts = parallel([lambda f=f: agent(verify_prompt(f), schema=VERDICT_SCHEMA) for f in findings])
```

**JavaScript (`eval`, JavaScript backend):**

```js
phase("Find");
const found = await parallel(DIMENSIONS.map((d) => async () =>
    await agent(d.prompt, { schema: FINDINGS_SCHEMA }),
));
const findings = dedupe(found.flatMap((r) => r.findings)); // needs everything at once
phase("Verify");
const verdicts = await parallel(findings.map((f) => async () =>
    await agent(verifyPrompt(f), { schema: VERDICT_SCHEMA }),
));
```

Flatten/map/filter with ordinary code between calls; no barrier merely for that. Nested `parallel()` pools cap independently: keep total fan-out sane.
</structure>

<patterns>
Use task-appropriate harness:
- **Adversarial verify**: N independent skeptics/finding, prompted REFUTE; retain only majority survivors. `votes = parallel([lambda i=i: agent(f"Refute: {claim}. refuted=true if unsure.", schema=VERDICT) for i in range(3)])`; retain when `sum(not v["refuted"] for v in votes) ≥ 2`.
- **Perspective-diverse verify**: distinct verifier lenses — correctness, security, perf, does-it-reproduce — not N identical refuters.
- **Judge panel**: N angle-diverse attempts; parallel judges score; synthesize winner, graft best remainder.
- **Loop-until-dry**: unknown-size discovery: spawn finders until K consecutive rounds yield nothing new; dedup against all SEEN, not only confirmed, or no convergence.
- **Multi-modal sweep**: parallel mutually blind finders by-container/by-content/by-entity/by-time.
- **Completeness critic**: final agent asks `"what's missing — modality not run, claim unverified, file unread?"`; answer drives next round.
- **Budget/count loops**: Python `while len(bugs) < 10:`; JavaScript `while (bugs.length < 10) { … }`. Python explicit-budget gate: `budget.total`, `budget.remaining()`; JavaScript: `await budget.total()`, `await budget.remaining()`. `log()` every round.
- **No silent caps**: bounded coverage (top-N, no-retry, sampling) → `log()` dropped work; otherwise truncation falsely implies complete coverage.

Scale: `"find any bugs"` → few finders, single-vote verify. `"thoroughly audit / be comprehensive"` → larger finder pool, 3–5-vote adversarial pass, synthesis.
</patterns>

<execution>
 - Decompose surface first; multi-phase work: capture in `todo`.
 - Agent output branched on → prefer a valid JSON Schema object via `schema=`; validate the schema shape before dispatch. A failed dispatch/preflight is a dispatch failure, not a subagent result; record it and either retry with a valid schema or classify it as failed before the result barrier.
 - Fan-out return: YOU own correctness — read artifacts, gate, verify before action. Subagents do legwork, not final word.
 - If Main has no independent, necessary work after dispatch, stop active exploration and wait for the full result barrier rather than inventing work or repeating summaries. During `WAIT_ALL`, do not read `agent://`/`history://` artifacts and do not perform same-domain read/grep/search; only update internal status and wait/monitor.
 - A single returned result updates internal state but does not advance a phase that depends on all results. Collect success, failure, cancellation, and timeout before synthesis or advancement. Because `hub wait` is FIRST-event, repeat it or use an equivalent all-settled barrier until every dispatched subagent has a terminal status.
 - Continue until closed; returned fan-out is a step, not endpoint.
 - Default output policy: do not emit repeated partial summaries when subagents wake Main. Synthesize and output once after all required results are collected, unless the user requests progress or an immediate failure/blocker requires intervention.
</execution>
</system-notice>
