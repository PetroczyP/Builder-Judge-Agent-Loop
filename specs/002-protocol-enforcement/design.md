# Design: Protocol Enforcement Improvements

**Task:** 002-protocol-enforcement
**Phase:** design
**Spec:** `specs/002-protocol-enforcement/spec.md`

## Design Decisions

### D-1: Step renumbering (clean sequential) over sub-steps

**Decision:** Renumber all steps sequentially (1, 2, 3...) when inserting new steps. Do not use sub-steps (1.5, 3.5).

**Rationale:** Agents parse numbered instructions sequentially. Sub-step numbering (1.5) is ambiguous — agents may skip it, thinking it's a sub-section of step 1. Clean numbering makes the pre-flight checklist a first-class step that's harder to overlook.

**Impact:**
- `loop.build.md`: Steps 1-7 → Steps 1-8
- `loop.review.md`: Steps 1-7 → Steps 1-9
- PROTOCOL.md judge workflow: Steps 1-6 → Steps 1-8

### D-2: Pre-flight as standalone step (not embedded in Step 5/Write)

**Decision:** Create a dedicated `### Step 5: Pre-flight checklist` between phase work (Step 4) and builder.md writing (Step 6).

**Rationale:** The current CoVe step is buried under a misleading heading ("Verification step (between Step 4 and Step 5)") which is physically positioned _after_ Step 5 in the template. This is the root cause of agents skipping it — it doesn't appear in the sequential flow. A standalone numbered step with its own heading eliminates this.

### D-3: CoVe method enforcement via explicit categorization

**Decision:** The CoVe step explicitly categorizes claims as external or internal, with required methods for each.

**Rationale:** The current CoVe step says "web search for any claim about external tools" but doesn't define what counts as external vs internal. Making this explicit:
- **External**: SDK behavior, API signatures, library features, tool capabilities, compatibility claims
- **Internal**: Repo structure, existing code behavior, file contents, project conventions, architecture decisions
- **Method**: External → web search. Internal → repo search (Grep, Read, Glob).

### D-4: Tiered severity for preflight violations

**Decision:** Missing CoVe on mandatory phases (specify, design, build) = H-severity. Missing on optional phases (test, release) = L-severity. Missing anti-pattern check on any phase = L-severity.

**Rationale:** Not all violations are equal. A design phase without CoVe risks building on hallucinated SDK behavior (high impact). A release phase without CoVe is summarizing already-validated work (low impact). Uniform severity would either over-penalize release phases or under-penalize design phases.

### D-5: Isolation detection as best-effort first step

**Decision:** The judge's isolation self-check is the first action after command parsing. It checks for prior conversation context. It stops and instructs proper invocation if detected.

**Rationale:** `context: fork` provides a clean slate with zero conversation history. If the judge observes conversation turns, tool calls, or builder work above its prompt, it was pasted into an active session (the most common misuse). This is best-effort — it cannot detect all misuse (e.g., manually clearing context before pasting). But it catches the primary failure mode observed in field testing.

### D-6: `model: inherit` explicit despite being default

**Decision:** Add `model: inherit` explicitly to claude-judge.md frontmatter.

**Rationale:** Web search confirmed `inherit` is the default when no model field is specified. Making it explicit: (1) documents intent — this is a deliberate design choice, not an accident; (2) is greppable for AC-9 verification; (3) protects against future default changes. The cost is one line of YAML. The benefit is clarity and verifiability.

### D-7: Test gate with escape hatch for non-behavioral rounds

**Decision:** Build phase requires at least one new test per round when new behavior is introduced. Non-behavioral rounds (refactoring, docs, config, templates) may skip with justification in `### Test Evidence`.

**Rationale:** Blanket "must write tests" fails for legitimate non-behavioral rounds. The escape hatch requires explicit justification that the judge evaluates. This prevents both: (a) test-skipping (the original field-test problem — zero tests despite TDD requirement), and (b) test theater (writing meaningless tests to satisfy a gate).

### D-8: Phase-skip in CREATE mode only

**Decision:** Phase-skip guardrails apply only to CREATE mode in loop.build.md.

**Rationale:** ADVANCE mode moves one phase at a time (judge accepts current phase → coordinator advances to next). Skipping happens at task creation when the builder determines the appropriate starting point. There is no skipping in ADVANCE mode by definition.

### D-9: Legacy task graceful handling

**Decision:** When the judge encounters a task without `preflight` or `skipped_phases` fields, note "Pre-enforcement task — evaluating on content merits" and proceed without blocking.

**Rationale:** Backwards compatibility is a hard constraint (AC-11). Existing tasks created before this change should not become unjudgeable. The judge evaluates their quality on substance, not metadata.

### D-10: Preflight evidence in both builder.md and status.json

**Decision:** builder.md contains the evidence (### Verification, ### Anti-Pattern Check sections). status.json contains boolean flags (preflight.cove_completed, preflight.antipatterns_checked). The judge cross-references both.

**Rationale:** The evidence sections in builder.md are what the judge actually evaluates for quality. The flags in status.json provide a quick machine-readable check that's useful for tooling and the judge's preflight step. Both are needed — flags without evidence are meaningless (AP-001), evidence without flags means the builder didn't follow the template.

---

## Change Map

### File 1: `src/templates/commands/loop.build.md`

| Section | Change | Spec ref |
|---------|--------|----------|
| Step 2: CREATE mode | Add phase-skip guardrails with justification requirements, conditional spec path | FR1, S1, S9 |
| Step 4: build phase | Add test gate with escape hatch | FR4, S8 |
| NEW Step 5: Pre-flight checklist | Absorb CoVe step, add method categorization, add anti-pattern check, add preflight flag update | FR2, FR3, S2, S3 |
| Step 6 (was 5): builder.md template | Add `### Anti-Pattern Check` section | FR3, AC-6 |
| Step 7 (was 6): status.json update | Add timestamp enforcement with example command, add preflight flags | FR5, S7, AC-5 |
| Remove: "Verification step (between Step 4 and Step 5)" | Absorbed into new Step 5 | — |

**Step renumbering:**
```
BEFORE                          AFTER
Step 1: Parse command           Step 1: Parse command (unchanged)
Step 2: Handle mode             Step 2: Handle mode (modified: phase-skip in CREATE)
Step 3: Read task context       Step 3: Read task context (unchanged)
Step 4: Phase work              Step 4: Phase work (modified: build test gate)
"between Step 4 and Step 5"    Step 5: Pre-flight checklist (NEW, absorbs old CoVe)
Step 5: Write builder.md       Step 6: Write builder.md (modified: anti-pattern section)
Step 6: Update status.json     Step 7: Update status.json (modified: timestamp + preflight)
Step 7: Report                  Step 8: Report (unchanged content)
```

### File 2: `src/templates/commands/loop.review.md`

| Section | Change | Spec ref |
|---------|--------|----------|
| NEW Step 2: Isolation self-check | Detect non-fork invocation, stop if violated | FR7, S6, AC-7 |
| NEW Step 5: Preflight verification | Verify builder compliance before content evaluation, tiered severity, 3+-phase-skip escalation rule | FR6, S4, AC-8 |
| Step 8 (was 6): status.json update | Add review_context recording | FR7 |

**Preflight verification detail (Step 5):**

The judge's preflight step checks:
1. CoVe completion — H-severity if missing on mandatory phases (specify, design, build), L-severity if missing on optional (test, release)
2. CoVe method correctness — for each claim in the builder's `### Verification` section, verify the method matches the claim type:
   - External claims (SDK, API, library, tool behavior) should use **web search**
   - Internal claims (repo structure, code behavior, file contents) should use **repo search**
   - Method mismatch (e.g., web search for an internal claim, or repo search for an external API) → **L-severity** (per FR6, spec.md:123; wrong method is better than no verification, but the right method should be used)
3. Anti-pattern check — L-severity if missing on any phase
4. Phase-skip justifications:
   - Generic justifications → H-severity
   - Referenced artifacts must actually exist
   - **If 3 or more phases are skipped → H-severity requiring strong justification for each** (per FR6, spec.md:125)
5. Legacy tasks — note absence, evaluate on content merits, don't block

**Step renumbering:**
```
BEFORE                          AFTER
Step 1: Parse command           Step 1: Parse command (unchanged)
                                Step 2: Isolation self-check (NEW)
Step 2: Read context            Step 3: Read context (updated cross-ref)
Step 3: Context management      Step 4: Context management (unchanged content)
                                Step 5: Preflight verification (NEW)
Step 4: Review and evaluate     Step 6: Review and evaluate (unchanged content)
Step 5: Write judge.md          Step 7: Write judge.md (unchanged content)
Step 6: Update status.json      Step 8: Update status.json (modified: review_context)
Step 7: Report                  Step 9: Report (unchanged content)
```

### File 3: `src/templates/agents/claude-judge.md`

| Section | Change | Spec ref |
|---------|--------|----------|
| Frontmatter | Add `model: inherit` | FR8, AC-9 |

One-line change. No other modifications.

### File 4: `src/templates/protocol/PROTOCOL.md`

| Section | Change | Spec ref |
|---------|--------|----------|
| After "State Guards" | Add "Phase Skipping" section with rules, valid/invalid examples, 3+-phase threshold | FR9, AC-10 |
| status.json schema | Add `skipped_phases`, `preflight`, `review_context` optional fields | FR9, AC-10 |
| CoVe section | Add verification method categorization (external/internal) | FR9, AC-10 |
| Builder Output Format | Add `### Anti-Pattern Check` section to documented template | FR3, AC-6, AC-10 |
| Judge Workflow | Renumber steps 1-8, add isolation self-check (Step 2), add preflight verification (Step 5) with 3+-phase escalation rule and CoVe method mismatch check (L-severity) | FR9, AC-10 |

**Note:** The Builder Output Format in PROTOCOL.md must stay in sync with the `loop.build.md` builder.md template. Since `claude-judge.md` falls back to PROTOCOL.md when `/loop.review` is not invoked, any template/protocol drift is user-visible. Both documents must include `### Anti-Pattern Check`.

---

## Status.json Schema (Final)

```json
{
  "task_id": "string",
  "phase": "string",
  "state": "string",
  "round": "number",
  "max_rounds": "number",
  "builder": "string",
  "judge": "string",
  "verdict": "string | null",
  "updated_at": "string (real ISO 8601 — never placeholder)",

  "skipped_phases": [
    { "phase": "string", "justification": "string (must reference concrete artifact or constraint)" }
  ],

  "preflight": {
    "cove_completed": "boolean",
    "antipatterns_checked": "boolean"
  },

  "review_context": "string (context_fork | codex_agent)",

  "history": [
    { "round": "number", "phase": "string", "actor": "string", "verdict": "string | null", "timestamp": "string" }
  ]
}
```

**New fields** (`skipped_phases`, `preflight`, `review_context`) are all optional. Absence means "task created before protocol enforcement" — agents handle gracefully.

---

## Template Variable Dependencies

Existing template variables referenced in the files:
- `$ARGUMENTS` — user input (loop.build.md, loop.review.md)
- `{{JUDGE_INVOKE_INSTRUCTION}}` — how to invoke the judge (loop.build.md)
- `{{MAX_ROUNDS}}` — round limit (loop.review.md, PROTOCOL.md)
- `{{BUILDER_AGENT_NAME}}`, `{{JUDGE_AGENT_NAME}}` — agent names (PROTOCOL.md)
- `{{BUILDER_AGENT_ID}}`, `{{JUDGE_AGENT_ID}}` — agent IDs (PROTOCOL.md)
- `{{COORDINATOR_NAME}}` — coordinator name (claude-judge.md)

No new template variables are introduced. All new content is static text.
