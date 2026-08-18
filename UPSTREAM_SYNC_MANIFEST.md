# Upstream Functional Sync Manifest

- Fork baseline: `35e16aee87` plus local integration baseline `9a8742f491`.
- Common ancestor: `ffd53ff92a6f575d499730475a73460dd7cc2eea`.
- Fixed upstream snapshot: `8500092296621a6826b7136e840f8a59ea338958` (`2026-08-18`).
- Candidate policy: `203` non-merge commits reviewed individually; `83` merge commits are not replayed as content units.
- Decisions: 186 included, 17 excluded.

## Conflict and metadata policy

- Fork package names (`@dude1wudv/*`), the fork release line (bumped from `20.1.6` to `20.1.7` after integration), release tooling, and Windows publishing behavior are authoritative.
- Functional source, tests, prompts, model catalog data, setup support, and required dependency declarations are integrated.
- Pure release/version, package-scope migration, documentation/changelog, formatting, and release-only CI content are excluded.
- “Manual conflict reconciliation” means the commit touched a path that required semantic reconciliation; otherwise Git applied it through the snapshot merge.

## Commit-by-commit audit

| Upstream commit | Date | Subject | Decision | Batch | Reason | Result |
|---|---|---|---|---|---|---|
| `f13ee010d038` | 2026-08-11 | fix(catalog): omitted forced tool choice for go responses | Include | 1 | functional source/test/config change | manual conflict reconciliation |
| `b3b95e769f9c` | 2026-08-12 | fix(tui): multi-select ask dialog submits on Enter instead of dead-ending | Include | 3 | functional source/test/config change | three-way auto-merge |
| `0a679284d871` | 2026-08-12 | fix(ai): preserve streamed thinking start content | Include | 1 | functional source/test/config change | manual conflict reconciliation |
| `d1680450d2fa` | 2026-08-12 | fix(vibe): canceled active turn on mode exit | Include | 3 | functional source/test/config change | manual conflict reconciliation |
| `8edab1af80d2` | 2026-08-12 | fix(vibe): suppress queued-turn drain during mode exit | Include | 2/3 | functional source/test/config change | manual conflict reconciliation |
| `7255ffd596ef` | 2026-08-12 | fix(vibe): isolated mode-exit drain suppression | Include | 2/3 | functional source/test/config change | manual conflict reconciliation |
| `a69ce173986d` | 2026-08-12 | fix(session): reset queued drain scheduling state | Include | 2/3 | functional source/test/config change | three-way auto-merge |
| `b245be11c51c` | 2026-08-12 | fix(ask): address review comments on multi-select Enter submit | Include | 3 | functional source/test/config change | three-way auto-merge |
| `d0e505b4f8ba` | 2026-08-13 | fix(ai): rotate Cursor conversationId after a poisoned conversation | Include | 1 | functional source/test/config change | three-way auto-merge |
| `337b75a7d3bc` | 2026-08-12 | fix(catalog): expose Baseten Kimi K3 thinking levels | Include | 1 | functional source/test/config change | manual conflict reconciliation |
| `96cd56ebc7e1` | 2026-08-12 | refactor(catalog): clarify Baseten reasoning gate | Include | 1 | functional source/test/config change | manual conflict reconciliation |
| `b55dcd01ffc3` | 2026-08-13 | feat(ai): add retryTransientCompletion for oneshot LLM calls | Include | 1 | functional source/test/config change | three-way auto-merge |
| `0523c7112f47` | 2026-08-13 | feat(agent): add opt-in transient retry to instrumentedCompleteSimple | Include | 2 | functional source/test/config change | three-way auto-merge |
| `720ac2168acd` | 2026-08-13 | fix(agent): retry handoff, branch summary and manual /compact on a blip | Include | 2/3 | functional source/test/config change | three-way auto-merge |
| `38a2040b8d4c` | 2026-08-13 | fix(coding-agent): retry transient failures at oneshot LLM call sites | Include | 2/3/4 | functional source/test/config change | manual conflict reconciliation |
| `d3ad83b3a844` | 2026-08-13 | fix(models): isolate ambient hooks from catalog listing | Include | 3 | functional source/test/config change | manual conflict reconciliation |
| `5de3db146af8` | 2026-08-13 | fix(nix): remove build-time Bun closure reference | Include | 3/4 | functional source/test/config change | three-way auto-merge |
| `ec785469f365` | 2026-08-13 | fix(theme): improve birch user/custom card contrast | Include | 3 | functional source/test/config change | three-way auto-merge |
| `9bb18d3e0e81` | 2026-08-13 | fix(tui): update welcome banner model name on model_changed event | Include | 3 | functional source/test/config change | manual conflict reconciliation |
| `272a0e846161` | 2026-08-13 | fix(tui): resync welcome banner after init-time model changes | Include | 3 | functional source/test/config change | manual conflict reconciliation |
| `7b5921abc5f8` | 2026-08-13 | fix(tui): request repaint after catch-up model sync | Include | 3 | functional source/test/config change | manual conflict reconciliation |
| `3d05d9ae2ff9` | 2026-08-13 | fix(tui): classify a long loop block by CPU time instead of duration | Include | 3 | functional source/test/config change | three-way auto-merge |
| `7e384fbc4fc5` | 2026-08-12 | fix(extensions): pause tool-call timeout during human dialogs | Include | 2/3 | functional source/test/config change | manual conflict reconciliation |
| `45b023cd8316` | 2026-08-13 | fix(tui): keep btw panels out of scrollback | Include | 3 | functional source/test/config change | manual conflict reconciliation |
| `90e4055da63a` | 2026-08-13 | fix(lsp): don't report a crashed checker as a clean workspace | Include | 3 | functional source/test/config change | three-way auto-merge |
| `6a6d5f02e764` | 2026-08-13 | style(lsp): collapse the exit-status ternary to satisfy biome | Exclude | 3 | pure formatting | content restored/preserved from fork |
| `41dfc2cd9e51` | 2026-08-14 | fix(hub): skip mid-spawn stubs in persisted scan | Include | 2/3 | functional source/test/config change | three-way auto-merge |
| `dadaceaa6fe0` | 2026-08-13 | fix(edit): add compact seen-line retries | Include | 3/4 | functional source/test/config change | three-way auto-merge |
| `077b6af2fb81` | 2026-08-13 | test(ci): pin how a chunk's SIGKILL cause is reported | Include | 4 | functional source/test/config change | three-way auto-merge |
| `6b78c4e11253` | 2026-08-13 | fix(ci): chunk the singleton bucket and name the cause of a SIGKILLed chunk | Include | 4 | functional source/test/config change | three-way auto-merge |
| `fd28acf5a1fc` | 2026-08-13 | fix(extensions): harden dialog timeouts | Include | 3 | functional source/test/config change | manual conflict reconciliation |
| `21a4d0b2fa66` | 2026-08-13 | revert(ci): keep the singleton bucket unchunked | Include | 4 | functional source/test/config change | three-way auto-merge |
| `44834fdd23fd` | 2026-08-11 | fix(tui): preserve scrollback after hidden tool snapshots | Include | 2/3 | functional source/test/config change | three-way auto-merge |
| `705442dbdefa` | 2026-08-13 | fix(edit): preserve guard after transformed writes | Include | 3/4 | functional source/test/config change | three-way auto-merge |
| `357317595c40` | 2026-08-13 | fix(coding-agent): filter Claude custom tool modules | Include | 3 | functional source/test/config change | three-way auto-merge |
| `5e903cbb79ab` | 2026-08-13 | fix(edit): address seen-line retry review | Include | 3 | functional source/test/config change | three-way auto-merge |
| `f9f7d878ea5b` | 2026-08-13 | docs(changelog): attribute Claude tool fix | Exclude | 3 | pure documentation/changelog | content restored/preserved from fork |
| `ce44bac3c771` | 2026-08-14 | fix(ai): classify DashScope/Bailian 429 TPM throttle as transient instead of quota exhaustion | Include | 1 | functional source/test/config change | three-way auto-merge |
| `da76e6249615` | 2026-08-14 | fix(agent): removed capped empty stop tails | Include | 2/3 | functional source/test/config change | three-way auto-merge |
| `5421add83b2c` | 2026-08-14 | fix(coding-agent): reclaim dead parked agent corpses on respawn | Include | 3 | functional source/test/config change | three-way auto-merge |
| `2929670a252c` | 2026-08-14 | fix(coding-agent): preserved cold-revivable parked agents | Include | 3 | functional source/test/config change | three-way auto-merge |
| `87970fb2b20e` | 2026-08-14 | fix(session): made discarded empty stops durable | Include | 2/3 | functional source/test/config change | three-way auto-merge |
| `6c119503664b` | 2026-08-14 | fix(session): preserved discard metadata children | Include | 2/3 | functional source/test/config change | three-way auto-merge |
| `9b496847235f` | 2026-08-13 | use /v1/ APIs for llama.cpp for better compatibility | Include | 3 | functional source/test/config change | three-way auto-merge |
| `617fc4d51b85` | 2026-08-13 | update changelog | Exclude | 3 | pure documentation/changelog | content restored/preserved from fork |
| `23319fa41367` | 2026-08-13 | fixup /v1/ for all llama.cpp models, not just qwen. | Include | 3 | functional source/test/config change | three-way auto-merge |
| `6ebc4042e639` | 2026-08-13 | reuse existing functions to ensure v1 prefix | Include | 3 | functional source/test/config change | three-way auto-merge |
| `d256367b7220` | 2026-08-14 | fix(agent): name billed output tokens on capped empty stops | Include | 2/3 | functional source/test/config change | three-way auto-merge |
| `b6aa92b143e2` | 2026-08-14 | fix(agent): restrict billed-output empty-stop message to zero-block stops | Include | 2/3 | functional source/test/config change | three-way auto-merge |
| `24779714e617` | 2026-08-13 | fix(agent): optimize checkpoint/rewind prompt rendering | Include | 2/3 | functional source/test/config change | manual conflict reconciliation |
| `0b294ead5b24` | 2026-08-14 | fix(agent): deliver checkpoint-active reminder synchronously from a prompt file | Include | 2/3 | functional source/test/config change | manual conflict reconciliation |
| `c647b42d11a5` | 2026-08-14 | ci: re-trigger after flaky sdk-tool-activation timeout | Include | 4 | functional source/test/config change | three-way auto-merge |
| `63ac830b50fd` | 2026-08-14 | fix(session): resume Cursor turns after HTTP/2 stream reset | Include | 1/2/3 | functional source/test/config change | manual conflict reconciliation |
| `e49ee4b4e21b` | 2026-08-13 | feat(catalog): add GLM-5.3 support with uniform low/high/max effort ladder and mandatory thinking | Include | 1 | functional source/test/config change | manual conflict reconciliation |
| `f02679bdf58b` | 2026-08-14 | fix(ai): report Umans usage from weighted effective requests | Include | 1 | functional source/test/config change | three-way auto-merge |
| `30f92ad98634` | 2026-08-14 | fix(coding-agent): keep the system prompt byte-stable across date/cwd changes | Include | 2/3 | functional source/test/config change | manual conflict reconciliation |
| `c7dde59f6525` | 2026-08-14 | fix(agent): set checkpoint runtime state synchronously with the active notice | Include | 2/3 | functional source/test/config change | manual conflict reconciliation |
| `04380e93c08f` | 2026-08-14 | fix(tests): pruned bazel convenience symlinks from bun test discovery | Include | 4 | functional source/test/config change | three-way auto-merge |
| `1f0c2366d0e2` | 2026-08-14 | fix(vibe): distinguish wait abort from timeout | Include | 3 | functional source/test/config change | three-way auto-merge |
| `3775cd099c60` | 2026-08-14 | fix(discovery): honored non-recursive glob in loadFilesFromDir | Include | 3 | functional source/test/config change | manual conflict reconciliation |
| `8afd71d921a7` | 2026-08-14 | fix(coding-agent): classify user-invoked /skill turns under auto thinking | Include | 2/3 | functional source/test/config change | manual conflict reconciliation |
| `dc0e2ebeed7d` | 2026-08-14 | fix(utils): stop indented code interrupting paragraphs in marked lexer | Include | 3/4 | functional source/test/config change | three-way auto-merge |
| `c3b1032c3cdc` | 2026-08-14 | fix(coding-agent): stopped invalid Anthropic thinking fallback | Include | 2/3 | functional source/test/config change | three-way auto-merge |
| `bee1d44bf9f1` | 2026-08-14 | fix(ai): preserved anthropic tool-search replay blocks | Include | 1/2 | functional source/test/config change | manual conflict reconciliation |
| `77336d880cc3` | 2026-08-14 | fix(coding-agent): blocked model-bound Anthropic fallback | Include | 2/3 | functional source/test/config change | three-way auto-merge |
| `ea9e299f96b7` | 2026-08-14 | fix(ai): fail truncated OpenAI-compatible streams instead of silently stopping | Include | 1 | functional source/test/config change | manual conflict reconciliation |
| `6e4334c003d6` | 2026-08-01 | feat(extensions): broker denied file writes and deletes | Include | 3 | functional source/test/config change | manual conflict reconciliation |
| `6ad935d093ed` | 2026-08-09 | fix(extensions): resolved brokered file paths and named their session | Include | 3 | functional source/test/config change | three-way auto-merge |
| `cb4b936b938b` | 2026-08-09 | fix(extensions): rebuilt the fallback context on each invocation | Include | 3 | functional source/test/config change | three-way auto-merge |
| `2c5a9c43aa44` | 2026-08-10 | test(tools): pinned the exclusive-create guard against the fallback seam | Include | 3 | functional source/test/config change | three-way auto-merge |
| `2230361fcde7` | 2026-08-12 | fix(lsp): kept brokered batch content for a denied flush reread | Include | 3 | functional source/test/config change | manual conflict reconciliation |
| `f3d3985e9562` | 2026-08-13 | test(rpc): pinned a pre-ready worker that never exits | Include | 3 | functional source/test/config change | manual conflict reconciliation |
| `3997693a974d` | 2026-08-14 | test(browser): sized the relay lease test above its own waits | Include | 3 | functional source/test/config change | three-way auto-merge |
| `e287a8c6e2a4` | 2026-08-14 | fix(browser): probe CDP endpoints over raw TCP to bypass HTTP_PROXY | Include | 3 | functional source/test/config change | manual conflict reconciliation |
| `f36cf20d56e6` | 2026-08-15 | fix(mcp): keep Exa MCP servers that request non-native tools | Include | 3 | functional source/test/config change | three-way auto-merge |
| `e4b5b3f7951a` | 2026-08-14 | fix(tui): stopped inline code color bleed at soft wraps | Include | 4 | functional source/test/config change | three-way auto-merge |
| `7f5590258e8e` | 2026-08-15 | fix(builtins): handled empty xargs replace input | Include | 4 | functional source/test/config change | three-way auto-merge |
| `9ae089d71bca` | 2026-08-15 | fix(session): repaired torn JSONL appends | Include | 2/3/4 | functional source/test/config change | manual conflict reconciliation |
| `8344a0e82337` | 2026-08-14 | fix: stop mid-run compaction from awaiting lifecycle emits | Include | 2/3 | functional source/test/config change | three-way auto-merge |
| `eb8c854c7092` | 2026-08-14 | docs: add JSDoc on detached compaction lifecycle emit | Include | 2/3 | functional source/test/config change | three-way auto-merge |
| `e4ec9f7cc8b3` | 2026-08-14 | Keep auto_compaction_start awaited on the mid-run path | Include | 2/3 | functional source/test/config change | three-way auto-merge |
| `1fc05fc635ce` | 2026-08-15 | fix(tui): waited for wire-aliased edit previews | Include | 3 | functional source/test/config change | manual conflict reconciliation |
| `40e830f9cfc1` | 2026-08-14 | fix(lsp): gate rust-analyzer/reloadWorkspace behind rust-analyzer check | Include | 3 | functional source/test/config change | three-way auto-merge |
| `c228dea58b55` | 2026-08-02 | feat(catalog): route paid xAI through Responses like SuperGrok | Include | 1/3 | functional source/test/config change | manual conflict reconciliation |
| `651f20957bff` | 2026-08-02 | feat(catalog): replay xAI encrypted reasoning on later turns | Include | 1/3 | functional source/test/config change | manual conflict reconciliation |
| `bd44ff190ccb` | 2026-08-02 | docs: keep xAI changelog entries under Unreleased after 17.2.5 | Exclude | 1/3 | pure documentation/changelog | content restored/preserved from fork |
| `ef7759782d1e` | 2026-08-02 | fix(catalog): drop stale xAI Chat Completions model-cache rows | Include | 1 | functional source/test/config change | manual conflict reconciliation |
| `7a3a558895fd` | 2026-08-02 | fix(catalog): clamp paid xAI Responses minimal effort to low | Include | 1 | functional source/test/config change | manual conflict reconciliation |
| `ca2fa4f5f616` | 2026-08-02 | fix(ai): do not treat XAI_API_KEY as SuperGrok availability | Include | 1/3 | functional source/test/config change | manual conflict reconciliation |
| `3fb57803f301` | 2026-08-02 | fix(catalog): omit penalty and stop params on xAI reasoning models | Include | 1/3 | functional source/test/config change | manual conflict reconciliation |
| `b49b5b88d233` | 2026-08-02 | fix(catalog): strip stale xAI Responses effort dials from generated rows | Include | 1/3 | functional source/test/config change | manual conflict reconciliation |
| `01db5b04eed8` | 2026-08-02 | fix(catalog): omit unsupported reasoning.summary on paid xAI Responses | Include | 1 | functional source/test/config change | manual conflict reconciliation |
| `4c150d2a050e` | 2026-08-08 | docs: keep xAI changelog entries under Unreleased after 17.2.12 | Exclude | 1 | pure documentation/changelog | content restored/preserved from fork |
| `6c0f458279ff` | 2026-08-08 | fix(catalog): rebuild paid xAI Responses discovery after helper rename | Include | 1 | functional source/test/config change | manual conflict reconciliation |
| `09830d2bd657` | 2026-08-09 | fix(catalog): drop unsupported xhigh effort from first-party Grok | Include | 1 | functional source/test/config change | manual conflict reconciliation |
| `76faddf886cf` | 2026-08-09 | fix(catalog): omit reasoningEffortMap on no-dial xAI rows | Include | 1 | functional source/test/config change | manual conflict reconciliation |
| `86866b8bbfd8` | 2026-08-09 | fix(catalog): omit Responses penalties on all first-party xAI models | Include | 1 | functional source/test/config change | manual conflict reconciliation |
| `72168a69aead` | 2026-08-09 | fix(catalog): keep xhigh on Grok multi-agent Responses models | Include | 1 | functional source/test/config change | manual conflict reconciliation |
| `d14c028aeec4` | 2026-08-09 | fix(ai): allow explicit xai-oauth selectors with XAI_API_KEY | Include | 1/3 | functional source/test/config change | three-way auto-merge |
| `02eaee09bd07` | 2026-08-14 | style(catalog): sort generated-policies imports after rebase | Exclude | 1 | pure formatting | content restored/preserved from fork |
| `a7ac5d9fd356` | 2026-08-14 | fix(catalog): route main's grok-4.6 through first-party Responses | Include | 1 | functional source/test/config change | manual conflict reconciliation |
| `41a9afabf113` | 2026-08-15 | fix(auto-thinking): clear proxy thinking budget in online classifiers | Include | 2/3 | functional source/test/config change | manual conflict reconciliation |
| `d02aa3c85f2f` | 2026-08-14 | fix(catalog): advertise xhigh on first-party grok-4.6 Responses | Include | 1 | functional source/test/config change | manual conflict reconciliation |
| `682680e18674` | 2026-08-15 | fix(catalog): price Codex Daybreak aliases | Include | 1 | functional source/test/config change | manual conflict reconciliation |
| `1b2d0c9cfcde` | 2026-08-15 | refactor(catalog): trim unreachable Daybreak pricing cases | Include | 1 | functional source/test/config change | three-way auto-merge |
| `d6dcfed844df` | 2026-08-15 | fix(browser): suppressed blank shared startup window | Include | 3 | functional source/test/config change | manual conflict reconciliation |
| `da29b1211218` | 2026-08-15 | fix(tui): refresh token usage rows when toggled | Include | 3 | functional source/test/config change | three-way auto-merge |
| `99cd00928561` | 2026-08-15 | fix(cli): expanded marketplace catalog home paths | Include | 3 | functional source/test/config change | manual conflict reconciliation |
| `9852231ded2f` | 2026-08-15 | fix(ai): restored Kimi multi-account quota recovery | Include | 1 | functional source/test/config change | three-way auto-merge |
| `e8b7024b12d0` | 2026-08-15 | fix(hub): prevented stale agent refs from blocking wait | Include | 2/3 | functional source/test/config change | manual conflict reconciliation |
| `d4487773a31e` | 2026-08-15 | fix(ai): preserved opaque chat tool-call ids | Include | 1 | functional source/test/config change | manual conflict reconciliation |
| `2076dc3960b4` | 2026-08-15 | perf(session): stream persisted session init probes | Include | 2/3 | functional source/test/config change | manual conflict reconciliation |
| `7638f03121ec` | 2026-08-15 | fix(debug): scope report bundle to current session subtree | Include | 2/3 | functional source/test/config change | three-way auto-merge |
| `cbbaceac36b5` | 2026-08-15 | fix(session): preserve title slots in entry visitor | Include | 2/3 | functional source/test/config change | manual conflict reconciliation |
| `00043ef3babe` | 2026-08-15 | fix(ask): wrap long option labels in the rich ask dialog instead of truncating | Include | 3 | functional source/test/config change | three-way auto-merge |
| `7b6029277a16` | 2026-08-15 | fix(browser): clarify close release semantics | Include | 3 | functional source/test/config change | manual conflict reconciliation |
| `62eb6d40b852` | 2026-08-15 | fix(tui): bounded magic-keyword shimmer cpu | Include | 3 | functional source/test/config change | manual conflict reconciliation |
| `bb1de6d0e49e` | 2026-08-15 | fix(tui): preserved welcome columns for long model names | Include | 3 | functional source/test/config change | three-way auto-merge |
| `8c75bb7a61a1` | 2026-08-15 | chore: fix changelog spacing after main merge | Exclude | 3 | pure documentation/changelog | content restored/preserved from fork |
| `9f6fc1f0c705` | 2026-08-15 | fix(ai): surface Umans request exhaustion without a burst ceiling | Include | 1 | functional source/test/config change | three-way auto-merge |
| `c6e38c880bac` | 2026-08-15 | perf(coding-agent): bound streaming diff previews | Include | 3 | functional source/test/config change | three-way auto-merge |
| `ea93012be478` | 2026-08-15 | fix(coding-agent): preserve artifacts in CLI forks | Include | 2/3 | functional source/test/config change | three-way auto-merge |
| `006c5371eadd` | 2026-08-15 | perf(coding-agent): bound completed diff rendering | Include | 3 | functional source/test/config change | three-way auto-merge |
| `53378a402d1f` | 2026-08-15 | fix(ai): stop runaway repeated responses | Include | 1 | functional source/test/config change | manual conflict reconciliation |
| `62f59c86ebf7` | 2026-08-15 | fix(coding-agent): guard fork artifact paths | Include | 2/3 | functional source/test/config change | three-way auto-merge |
| `0fc2b0f42c3c` | 2026-08-15 | fix(launch): prune dead daemon runtime dirs on broker startup | Include | 3 | functional source/test/config change | manual conflict reconciliation |
| `d9eb0586bd43` | 2026-08-15 | fix(browser): prefer Chrome for Testing on macOS headless launch | Include | 3 | functional source/test/config change | manual conflict reconciliation |
| `9c695cf98a16` | 2026-08-15 | refactor(session): simplify streamed entry visits | Include | 2/3 | functional source/test/config change | manual conflict reconciliation |
| `8a746fdcc6dc` | 2026-08-16 | chore(catalog): regenerated models.json from upstream sources | Include | 1 | functional source/test/config change | three-way auto-merge |
| `de6b7974a065` | 2026-08-16 | fix(natives): fall back to cargo without bazel | Include | 4 | functional source/test/config change | three-way auto-merge |
| `5441679975d8` | 2026-08-16 | fix(ai): avoided duplicate block end on truncated streams | Include | 1 | functional source/test/config change | manual conflict reconciliation |
| `5cc9aa74bc64` | 2026-08-16 | fix(ask): used full dialog width for wrapped labels | Include | 3 | functional source/test/config change | three-way auto-merge |
| `2c530dc4a9a6` | 2026-08-16 | fix(ai): carried thinking start bytes through stream wrappers | Include | 1 | functional source/test/config change | manual conflict reconciliation |
| `65ee481aa2fb` | 2026-08-16 | fix(agent): delivered checkpoint reminder to active loop | Include | 2/3 | functional source/test/config change | manual conflict reconciliation |
| `c69d40fed369` | 2026-08-16 | test(tui): exercised transcript-level hidden state | Include | 3 | functional source/test/config change | three-way auto-merge |
| `7f2da16cdbcb` | 2026-08-16 | fix(hub): preserved concurrent live scan claims | Include | 3 | functional source/test/config change | three-way auto-merge |
| `36465c4e1ab0` | 2026-08-16 | fix(utils): preserved deeper lazy continuations | Include | 4 | functional source/test/config change | three-way auto-merge |
| `ffd838b2568b` | 2026-08-16 | fix(utils): detached deeper code after padded blanks | Include | 4 | functional source/test/config change | three-way auto-merge |
| `a59fc754b6f1` | 2026-08-16 | test(tui): covered welcome model synchronization | Include | 3 | functional source/test/config change | three-way auto-merge |
| `ea8d1d219199` | 2026-08-16 | docs(coding-agent): restored retry policy trailing newline | Exclude | 4 | pure documentation/changelog | content restored/preserved from fork |
| `33db3c600466` | 2026-08-16 | fix(ai): guarded DashScope throttle signature | Include | 1 | functional source/test/config change | three-way auto-merge |
| `f9012739186b` | 2026-08-16 | fix(coding-agent): detached mid-run lifecycle handlers fully | Include | 2/3 | functional source/test/config change | three-way auto-merge |
| `ba5885880e59` | 2026-08-14 | fix(coding-agent): preserved mixed-case plugin tool names on refresh | Include | 2/3 | functional source/test/config change | three-way auto-merge |
| `5102d3068fc4` | 2026-08-16 | fix(mcp): parsed separate Exa tools argument | Include | 3 | functional source/test/config change | three-way auto-merge |
| `acfce217f504` | 2026-08-16 | test(tui): asserted anchored status regions are pinned | Include | 3 | functional source/test/config change | three-way auto-merge |
| `446e745bf4bd` | 2026-08-16 | fix(edit): loaded seen-line retry guidance from prompt | Include | 3 | functional source/test/config change | three-way auto-merge |
| `7f250b9a5f1c` | 2026-08-16 | docs(coding-agent): noted browser release semantics | Exclude | 3 | release/version metadata only | content restored/preserved from fork |
| `4a37b7cc0992` | 2026-08-16 | docs(browser): qualified spawned kill behavior | Include | 3 | functional source/test/config change | three-way auto-merge |
| `d511ecd03f24` | 2026-08-16 | test(lsp): covered silent checker failures | Include | 3 | functional source/test/config change | three-way auto-merge |
| `6edbcf1f0e52` | 2026-08-16 | test(ci): ran watchdog attribution regression | Include | 4 | functional source/test/config change | manual conflict reconciliation |
| `e61cc18f6ba9` | 2026-08-16 | test(theme): covered birch card contrast | Include | 3 | functional source/test/config change | three-way auto-merge |
| `7b22a2309c5f` | 2026-08-16 | fix(tui): handled CPU-throttled loop stalls | Include | 3 | functional source/test/config change | three-way auto-merge |
| `d5fd4121151c` | 2026-08-16 | fix(tui): labeled single multi-select Enter as submit | Include | 3 | functional source/test/config change | three-way auto-merge |
| `a5284fb38193` | 2026-08-16 | fix(ask): preserved empty multi-select answers | Include | 3 | functional source/test/config change | three-way auto-merge |
| `16c118769874` | 2026-08-16 | fix(coding-agent): filtered Claude plugin tool modules | Include | 3 | functional source/test/config change | three-way auto-merge |
| `0547176f11e9` | 2026-08-16 | fix(models): skipped configured hooks in catalog listing | Include | 3 | functional source/test/config change | manual conflict reconciliation |
| `df6d1e1ac5e4` | 2026-08-16 | fix(ai): completed oneshot transient retry handling | Include | 1/2 | functional source/test/config change | three-way auto-merge |
| `55e5da3d1724` | 2026-08-16 | chore(changelog): normalized changelogs after merged fixes | Exclude | 1/2/3/4 | pure documentation/changelog | content restored/preserved from fork |
| `db056bd8cb06` | 2026-08-16 | chore(repo): applied biome formatting | Include | 1/2/3 | functional source/test/config change | manual conflict reconciliation |
| `3e64a24714a5` | 2026-08-16 | test(agent): typed abort-signal listener without DOM lib | Include | 2 | functional source/test/config change | three-way auto-merge |
| `2dba883e08ab` | 2026-08-16 | fix(launch): preserved global daemon service runtimes | Include | 3 | functional source/test/config change | manual conflict reconciliation |
| `91591acae6ff` | 2026-08-16 | fix(lsp): preserved rust-analyzer reload params | Include | 3 | functional source/test/config change | three-way auto-merge |
| `b200f938b7f9` | 2026-08-16 | fix(browser): bypassed proxies for relay probes | Include | 3 | functional source/test/config change | three-way auto-merge |
| `7af249b190f8` | 2026-08-16 | fix(coding-agent): preserved tool-search history on disk | Include | 2/3 | functional source/test/config change | manual conflict reconciliation |
| `44e50af90740` | 2026-08-16 | fix(agent): excluded reasoning from empty-stop diagnosis | Include | 2/3 | functional source/test/config change | three-way auto-merge |
| `c404f370e7fe` | 2026-08-16 | test(coding-agent): covered parked id respawn | Include | 2/3 | functional source/test/config change | manual conflict reconciliation |
| `1a5f07a26362` | 2026-08-16 | docs(ai): recorded repeated response guard | Exclude | 1 | pure documentation/changelog | content restored/preserved from fork |
| `d62a986689de` | 2026-08-14 | fix(lsp): stopped reaping clients with in-flight requests (#8390) | Include | 3 | functional source/test/config change | three-way auto-merge |
| `9501b2299bc7` | 2026-08-14 | fix(lsp): stopped reaping clients with in-flight requests (#8390) | Include | 3 | functional source/test/config change | three-way auto-merge |
| `815ba4417304` | 2026-08-14 | test(lsp): drove every idle assertion from a single clock read | Include | 3 | functional source/test/config change | three-way auto-merge |
| `776c9b9c4d1f` | 2026-08-14 | test(lsp): localized the native/unit failure with a temporary probe | Include | 3 | functional source/test/config change | three-way auto-merge |
| `87cfda9368bb` | 2026-08-14 | test(lsp): restored idle suite and completed the fake process shape | Include | 3 | functional source/test/config change | three-way auto-merge |
| `96922bd5c9ff` | 2026-08-15 | fix(ai): flattened xAI MCP exclusive-required anyOf | Include | 1 | functional source/test/config change | three-way auto-merge |
| `cb96258405e0` | 2026-08-15 | fix(ai): flattened xAI exclusive-required anyOf at tool root only | Include | 1 | functional source/test/config change | three-way auto-merge |
| `7c5ee37227fb` | 2026-08-15 | fix(ai): scoped xAI root-union flatten and quarantine | Include | 1 | functional source/test/config change | manual conflict reconciliation |
| `668cb2115f29` | 2026-08-16 | fix(ai): scoped exclusive-required flattening to xAI | Include | 1 | functional source/test/config change | manual conflict reconciliation |
| `5b2497116378` | 2026-08-16 | fix(extensions): charged custom dialog setup to timeout | Include | 3 | functional source/test/config change | manual conflict reconciliation |
| `d57a0ff23385` | 2026-08-16 | fix(extensions): preserved drafts before custom presentation | Include | 3 | functional source/test/config change | manual conflict reconciliation |
| `c162a82169c9` | 2026-08-16 | fix(vibe): deferred IRC wakes during mode exit | Include | 2/3 | functional source/test/config change | manual conflict reconciliation |
| `a0717151da87` | 2026-08-16 | fix(catalog): matched generator key order for Daybreak compat override | Include | 1 | functional source/test/config change | three-way auto-merge |
| `f045ae0d07e7` | 2026-08-16 | fix(collab): replicated discarded branch markers | Include | 2/3 | functional source/test/config change | three-way auto-merge |
| `66df516fc410` | 2026-08-16 | chore(catalog): regenerated models.json from upstream sources | Include | 1 | functional source/test/config change | three-way auto-merge |
| `f474b43880ba` | 2026-08-16 | chore(changelog): normalized changelogs after merged fixes | Include | 1/2/3 | functional source/test/config change | manual conflict reconciliation |
| `4dc82c56b9c0` | 2026-08-16 | chore(session): removed unused loader import | Include | 2/3 | functional source/test/config change | three-way auto-merge |
| `d71ff70c3d90` | 2026-08-16 | fix(ai): updated Alibaba China console URL | Include | 1 | functional source/test/config change | three-way auto-merge |
| `3d1bad9c88e2` | 2026-08-16 | fix(coding-agent): map biome 2.x json reporter schema | Include | 3 | functional source/test/config change | three-way auto-merge |
| `8fdb6a41975f` | 2026-08-16 | fix(edit): dropped compact seen-line retry tokens (#8461) | Include | 3/4 | functional source/test/config change | three-way auto-merge |
| `fe6648cb563e` | 2026-08-16 | chore(edit): removed unused import left by retry-token revert | Include | 3 | functional source/test/config change | three-way auto-merge |
| `906f5b1463e5` | 2026-08-16 | style(coding-agent/registry): formatted persisted mid-spawn test writes as template literals | Exclude | 3/4 | pure formatting | content restored/preserved from fork |
| `ca1f184823d9` | 2026-08-16 | chore: rewritten changelogs | Include | 1/2/3/4 | functional source/test/config change | three-way auto-merge |
| `d4587e318e5f` | 2026-08-16 | feat(scripts): added script-based setup orchestration with optional cargo native mode | Include | 4 | functional source/test/config change | manual conflict reconciliation |
| `02cd22dc9bb6` | 2026-08-16 | feat: added live tracking and stale status warnings for agent activity snapshots | Include | 1/2/3/4 | functional source/test/config change | manual conflict reconciliation |
| `37eee7197895` | 2026-08-16 | chore: bump version to 17.3.5 | Include | 1/2/3/4 | functional source/test/config change | manual conflict reconciliation |
| `848f7fb0fd45` | 2026-08-16 | feat(catalog): default paid xAI and SuperGrok to grok-4.6 | Include | 1/3 | functional source/test/config change | manual conflict reconciliation |
| `16ad30111768` | 2026-08-17 | fix(stats): restore configurable dashboard bind host | Include | 2/3 | functional source/test/config change | manual conflict reconciliation |
| `d8c5659d9af3` | 2026-08-17 | feat(catalog): updated context window floor and pricing parameters for gpt models | Include | 1 | functional source/test/config change | manual conflict reconciliation |
| `ba71a0aa6ce8` | 2026-08-17 | docs(extensions): included sessionId in delete fallback request shape | Exclude | 4 | pure documentation/changelog | content restored/preserved from fork |
| `54e1a8c900d3` | 2026-08-17 | chore: bump version to 17.3.6 | Include | 1/2/3/4 | functional source/test/config change | manual conflict reconciliation |
| `7affc3d4028e` | 2026-08-17 | fix(ai): send omp User-Agent on xAI chat only | Include | 1 | functional source/test/config change | manual conflict reconciliation |
| `0a912cc46798` | 2026-08-17 | chore: bump version to 17.3.7 | Exclude | 1/2/3/4 | release/version metadata only | content restored/preserved from fork |
| `644ad30d6e94` | 2026-08-17 | chore: bump version to 17.3.7 | Exclude | 1/3 | release/version metadata only | content restored/preserved from fork |
| `adfa211bbf23` | 2026-08-18 | chore: bump version to 17.3.7 | Exclude | 3 | release/version metadata only | content restored/preserved from fork |
| `850009229662` | 2026-08-18 | chore: bump version to 17.3.7 | Exclude | 2 | release/version metadata only | content restored/preserved from fork |

## Merge commits

All 83 merge commits in the range are excluded as direct replay units. Their functional non-merge children are covered above; merge-only history, release metadata, and branch mechanics are not imported as independent changes.
